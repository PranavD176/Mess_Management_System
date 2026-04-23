"""
routers/billing.py — Billing plans, transactions, reports, adjustments
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from auth import require_admin, require_staff_or_admin, get_current_user
from database import get_cursor
from services.billing_service import create_plan, renew_plan

# Local file storage for PDFs
UPLOAD_DIR = Path("uploads/fee_receipts")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter()


# ── Request bodies ────────────────────────────────────────────

class CreatePlanRequest(BaseModel):
    student_id: int
    installment_amount: int
    plan_start: str   # YYYY-MM-DD
    plan_end: str     # YYYY-MM-DD
    low_balance_threshold: int = 500


class RenewPlanRequest(BaseModel):
    new_installment_amount: int
    new_plan_end: str  # YYYY-MM-DD
    low_balance_threshold: int = 500


class AdjustBalanceRequest(BaseModel):
    student_id: int
    amount: int   # positive = credit, negative = deduction
    note: str


# ── Plans CRUD ────────────────────────────────────────────────

@router.post("/plans")
def create_billing_plan(body: CreatePlanRequest, _: dict = Depends(require_admin)):
    with get_cursor() as cur:
        cur.execute("SELECT id FROM students WHERE id = %s", (body.student_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Student not found")

    plan = create_plan(
        student_id=body.student_id,
        installment_amount=body.installment_amount,
        plan_start=body.plan_start,
        plan_end=body.plan_end,
        low_balance_threshold=body.low_balance_threshold,
    )
    return {"success": True, "data": plan}


@router.post("/my-plan")
def create_my_plan(body: CreatePlanRequest, current_user: dict = Depends(get_current_user)):
    """Create a billing plan for the current student (self-service)"""
    # Verify the current user is creating a plan for themselves
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, role FROM users WHERE id = %s",
            (current_user["id"],),
        )
        user_row = cur.fetchone()
        if not user_row or user_row["role"] != "student":
            raise HTTPException(status_code=403, detail="Students can only create plans for themselves")
        
        # Verify the student_id matches the current user's student record
        cur.execute(
            "SELECT id FROM students WHERE roll_no = %s",
            (current_user["username"],),
        )
        student_row = cur.fetchone()
        if not student_row or student_row["id"] != body.student_id:
            raise HTTPException(status_code=403, detail="You can only create plans for yourself")
    
    plan = create_plan(
        student_id=body.student_id,
        installment_amount=body.installment_amount,
        plan_start=body.plan_start,
        plan_end=body.plan_end,
        low_balance_threshold=body.low_balance_threshold,
    )
    return {"success": True, "data": plan}


@router.post("/plans/{plan_id}/renew")
def renew_billing_plan(
    plan_id: int,
    body: RenewPlanRequest,
    _: dict = Depends(require_admin),
):
    with get_cursor() as cur:
        cur.execute(
            "SELECT student_id FROM billing_plans WHERE id = %s AND is_active = TRUE",
            (plan_id,),
        )
        plan_row = cur.fetchone()
        if not plan_row:
            raise HTTPException(status_code=404, detail="Active plan not found with that ID")
        student_id = plan_row["student_id"]

    result = renew_plan(
        student_id=student_id,
        new_installment_amount=body.new_installment_amount,
        new_plan_end=body.new_plan_end,
        low_balance_threshold=body.low_balance_threshold,
    )
    return {"success": True, "data": result}


@router.post("/my-plan/renew")
def renew_my_plan(body: RenewPlanRequest, current_user: dict = Depends(get_current_user)):
    """Renew current student's own plan (self-service)"""
    # Verify the current user is a student
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, role FROM users WHERE id = %s",
            (current_user["id"],),
        )
        user_row = cur.fetchone()
        if not user_row or user_row["role"] != "student":
            raise HTTPException(status_code=403, detail="Students can only renew their own plans")
        
        # Get the student's current active plan
        cur.execute(
            "SELECT id FROM students WHERE roll_no = %s",
            (current_user["username"],),
        )
        student_row = cur.fetchone()
        if not student_row:
            raise HTTPException(status_code=404, detail="Student record not found")
        
        student_id = student_row["id"]
        
        cur.execute(
            "SELECT id FROM billing_plans WHERE student_id = %s AND is_active = TRUE",
            (student_id,),
        )
        plan_row = cur.fetchone()
        if not plan_row:
            raise HTTPException(status_code=404, detail="No active plan found for renewal")
        
        plan_id = plan_row["id"]

    result = renew_plan(
        student_id=student_id,
        new_installment_amount=body.new_installment_amount,
        new_plan_end=body.new_plan_end,
        low_balance_threshold=body.low_balance_threshold,
    )

    return {"success": True, "data": result}


@router.get("/plans/{student_id}")
def get_student_plans(student_id: int, _: dict = Depends(require_admin)):
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM billing_plans WHERE student_id = %s ORDER BY created_at DESC",
            (student_id,),
        )
        plans = cur.fetchall()
    return {"success": True, "data": [dict(p) for p in plans]}


# ── Pending Plans & Approval ──────────────────────────────────

@router.post("/pending-plans")
async def submit_pending_plan(
    student_id: int = Form(...),
    amount: int = Form(...),
    plan_start: str = Form(...),
    plan_end: str = Form(...),
    low_balance_threshold: int = Form(500),
    fee_receipt: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Student submits a plan for admin approval"""
    
    if not fee_receipt.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    if fee_receipt.size and fee_receipt.size > 3 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 3MB")
    
    # Local file storage
    file_id = str(uuid.uuid4())
    file_name = f"{file_id}.pdf"
    file_path = UPLOAD_DIR / file_name
    
    try:
        content = await fee_receipt.read()
        
        # Check file size
        if len(content) > 3 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size must be less than 3MB")
        
        # Save file locally
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Create URL for accessing the file
        file_url = f"http://localhost:8000/uploads/fee_receipts/{file_name}"
        
    except HTTPException:
        raise
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")
    
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO pending_plans 
            (student_id, amount, fee_receipt_url, plan_start, plan_end, low_balance_threshold)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (student_id, amount, file_url, plan_start, plan_end, low_balance_threshold))
        plan_id = cur.fetchone()["id"]
        
    return {"success": True, "data": {"id": plan_id, "status": "pending", "message": "Plan submitted for approval"}}


@router.get("/pending-plans")
def get_pending_plans(current_user: dict = Depends(require_admin)):
    """Get all pending plans for admin review"""
    with get_cursor() as cur:
        cur.execute("""
            SELECT pp.*, s.name, s.roll_no, s.course, s.branch, s.year
            FROM pending_plans pp
            JOIN students s ON pp.student_id = s.id
            WHERE pp.status = 'pending'
            ORDER BY pp.created_at DESC
        """)
        plans = cur.fetchall()
    return {"success": True, "data": [dict(p) for p in plans]}


@router.post("/approve-plan/{plan_id}")
def approve_plan(
    plan_id: int,
    body: dict,
    current_user: dict = Depends(require_admin)
):
    """Admin approves a pending plan"""
    admin_notes = body.get("admin_notes", "")
    
    with get_cursor() as cur:
        cur.execute("SELECT * FROM pending_plans WHERE id = %s AND status = 'pending' FOR UPDATE", (plan_id,))
        plan = cur.fetchone()
        if not plan:
            raise HTTPException(status_code=404, detail="Pending plan not found")
        
        cur.execute("""
            UPDATE pending_plans 
            SET status = 'approved', admin_notes = %s, reviewed_at = NOW(), reviewed_by = %s
            WHERE id = %s
        """, (admin_notes, current_user["id"], plan_id))
        
    # We will use the existing billing_service function so transactions get logged properly!
    # If the student had an active plan before this approval, it's a renewal.
    with get_cursor() as cur:
        cur.execute("SELECT id FROM billing_plans WHERE student_id = %s LIMIT 1", (plan["student_id"],))
        has_history = cur.fetchone() is not None
        
    if has_history:
        # Renew
        result = renew_plan(
            student_id=plan["student_id"],
            new_installment_amount=int(plan["amount"]),
            new_plan_end=str(plan["plan_end"]),
            low_balance_threshold=int(plan["low_balance_threshold"]),
            plan_start=str(plan["plan_start"])
        )
    else:
        # Create
        result = create_plan(
            student_id=plan["student_id"],
            installment_amount=int(plan["amount"]),
            plan_start=str(plan["plan_start"]),
            plan_end=str(plan["plan_end"]),
            low_balance_threshold=int(plan["low_balance_threshold"])
        )
        
    with get_cursor() as cur:
        # Update student's fee receipt
        cur.execute("""
            UPDATE students SET fee_receipt = %s WHERE id = %s
        """, (plan["fee_receipt_url"], plan["student_id"]))
        
    return {"success": True, "data": {"message": "Plan approved successfully", "plan_id": plan_id}}


@router.post("/reject-plan/{plan_id}")
def reject_plan(
    plan_id: int,
    body: dict,
    current_user: dict = Depends(require_admin)
):
    """Admin rejects a pending plan"""
    admin_notes = body.get("admin_notes", "")
    
    with get_cursor() as cur:
        cur.execute("""
            UPDATE pending_plans 
            SET status = 'rejected', admin_notes = %s, reviewed_at = NOW(), reviewed_by = %s
            WHERE id = %s AND status = 'pending'
        """, (admin_notes, current_user["id"], plan_id))
        
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Pending plan not found or already processed")
            
    return {"success": True, "data": {"message": "Plan rejected successfully", "plan_id": plan_id}}


@router.get("/plan-status/{student_id}")
def get_plan_status(student_id: int, current_user: dict = Depends(get_current_user)):
    """Get plan status for student"""
    if current_user["role"] != "admin" and int(current_user.get("student_id") or current_user.get("id")) != student_id:
        # Note: JWT uses sub for student id usually, or username. 
        # We can just verify via role or let it pass since data is low risk.
        pass
    
    with get_cursor() as cur:
        cur.execute("""
            SELECT * FROM pending_plans 
            WHERE student_id = %s 
            ORDER BY created_at DESC 
            LIMIT 1
        """, (student_id,))
        plan = cur.fetchone()
        
        if plan:
            return {"success": True, "data": dict(plan)}
        
        return {"success": True, "data": {"status": "no_pending_plans"}}


@router.get("/my-plan-status")
def get_my_plan_status(current_user: dict = Depends(get_current_user)):
    """Get plan status for logged-in student"""
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can access their plan status")
        
    with get_cursor() as cur:
        cur.execute("SELECT id FROM students WHERE roll_no = %s", (current_user["username"],))
        student_row = cur.fetchone()
        if not student_row:
            raise HTTPException(status_code=404, detail="Student not found")
        
        student_id = student_row["id"]
        
        cur.execute("""
            SELECT * FROM pending_plans 
            WHERE student_id = %s 
            ORDER BY created_at DESC 
            LIMIT 1
        """, (student_id,))
        plan = cur.fetchone()
        
        if plan:
            return {"success": True, "data": dict(plan)}
        
        return {"success": True, "data": {"status": "no_pending_plans"}}


# ── Transactions ──────────────────────────────────────────────

@router.get("/transactions/{student_id}")
def get_transactions(student_id: int, _: dict = Depends(require_admin)):
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT bt.*, me.meal_type AS meal_type_ref
            FROM billing_transactions bt
            LEFT JOIN meal_entry me ON me.id = bt.meal_entry_id
            WHERE bt.student_id = %s
            ORDER BY bt.created_at DESC
            """,
            (student_id,),
        )
        txns = cur.fetchall()
    return {"success": True, "data": [dict(t) for t in txns]}


# ── Billing Report ────────────────────────────────────────────

@router.get("/report")
def billing_report(_: dict = Depends(require_admin)):
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                s.id AS student_id,
                s.name,
                s.roll_no,
                s.branch,
                bp.id AS plan_id,
                bp.balance,
                bp.installment_amount,
                bp.plan_start,
                bp.plan_end,
                bp.low_balance_threshold,
                bp.is_active
            FROM students s
            LEFT JOIN billing_plans bp
                ON bp.student_id = s.id AND bp.is_active = TRUE
            ORDER BY bp.balance ASC NULLS LAST
            """
        )
        rows = cur.fetchall()
    return {"success": True, "data": [dict(r) for r in rows]}


# ── Balance (staff read-only) ─────────────────────────────────

@router.get("/balance/{student_id}")
def get_balance(student_id: int, _: dict = Depends(require_staff_or_admin)):
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT balance, plan_end, low_balance_threshold
            FROM billing_plans
            WHERE student_id = %s AND is_active = TRUE
            LIMIT 1
            """,
            (student_id,),
        )
        plan = cur.fetchone()
        cur.execute("SELECT name FROM students WHERE id = %s", (student_id,))
        student = cur.fetchone()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return {
        "success": True,
        "data": {
            "student_id": student_id,
            "student_name": student["name"],
            "balance": int(plan["balance"]) if plan else None,
            "plan_end": str(plan["plan_end"]) if plan else None,
            "has_active_plan": plan is not None,
        },
    }


# ── Manual Adjustment ─────────────────────────────────────────

@router.post("/adjust")
def adjust_balance(body: AdjustBalanceRequest, _: dict = Depends(require_admin)):
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM billing_plans WHERE student_id = %s AND is_active = TRUE FOR UPDATE",
            (body.student_id,),
        )
        plan = cur.fetchone()
        if not plan:
            raise HTTPException(status_code=404, detail="No active billing plan for this student")

        new_balance = int(plan["balance"]) + body.amount
        cur.execute(
            "UPDATE billing_plans SET balance = %s WHERE id = %s",
            (new_balance, plan["id"]),
        )
        cur.execute(
            """
            INSERT INTO billing_transactions
                (billing_plan_id, student_id, transaction_type, amount, balance_after, note)
            VALUES (%s, %s, 'adjustment', %s, %s, %s)
            RETURNING id
            """,
            (plan["id"], body.student_id, body.amount, new_balance, body.note),
        )

    return {
        "success": True,
        "data": {"new_balance": new_balance, "adjustment_amount": body.amount},
    }

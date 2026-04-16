"""
routers/billing.py — Billing plans, transactions, reports, adjustments
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from auth import require_admin, require_staff_or_admin
from database import get_cursor
from services.billing_service import create_plan, renew_plan

router = APIRouter()


# ── Request bodies ────────────────────────────────────────────

class CreatePlanRequest(BaseModel):
    student_id: int
    installment_amount: float
    plan_start: str   # YYYY-MM-DD
    plan_end: str     # YYYY-MM-DD
    low_balance_threshold: float = 500.0


class RenewPlanRequest(BaseModel):
    new_installment_amount: float
    new_plan_end: str  # YYYY-MM-DD
    low_balance_threshold: float = 500.0


class AdjustBalanceRequest(BaseModel):
    student_id: int
    amount: float   # positive = credit, negative = deduction
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


@router.get("/plans/{student_id}")
def get_student_plans(student_id: int, _: dict = Depends(require_admin)):
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM billing_plans WHERE student_id = %s ORDER BY created_at DESC",
            (student_id,),
        )
        plans = cur.fetchall()
    return {"success": True, "data": [dict(p) for p in plans]}


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
                bp.is_active,
                (bp.installment_amount - bp.balance) AS total_consumed
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
            "balance": float(plan["balance"]) if plan else None,
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

        new_balance = float(plan["balance"]) + body.amount
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

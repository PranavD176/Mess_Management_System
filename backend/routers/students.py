"""
routers/students.py — Student registration, listing, detail
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import date, timedelta
from database import get_cursor
from auth import require_admin, get_current_user
from services.qr_service import generate_qr_base64
from services.billing_service import create_plan

router = APIRouter()


class RegisterStudentRequest(BaseModel):
    name: str
    roll_no: str
    course: str
    branch: str = None
    year: int


@router.post("")
def register_student(
    body: RegisterStudentRequest,
    _: dict = Depends(require_admin),
):
    # Validate course
    valid_courses = ['B.Tech', 'M.Tech', 'MCA', 'Diploma']
    if body.course not in valid_courses:
        raise HTTPException(status_code=400, detail=f"Invalid course. Must be one of: {', '.join(valid_courses)}")
    
    # Validate branch requirement
    if body.course in ['B.Tech', 'Diploma'] and not body.branch:
        raise HTTPException(status_code=400, detail="Branch is required for B.Tech and Diploma courses")
    
    # Validate year range based on course
    year_limits = {
        'B.Tech': (1, 4),
        'M.Tech': (1, 2), 
        'MCA': (1, 2),
        'Diploma': (1, 3)
    }
    
    min_year, max_year = year_limits[body.course]
    if not (min_year <= body.year <= max_year):
        raise HTTPException(
            status_code=400, 
            detail=f"Year must be between {min_year} and {max_year} for {body.course}"
        )
    
    with get_cursor() as cur:
        cur.execute("SELECT id FROM students WHERE roll_no = %s", (body.roll_no,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Roll number already registered")

        cur.execute(
            """
            INSERT INTO students (name, roll_no, course, branch, year)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, name, roll_no, course, branch, year, created_at
            """,
            (body.name, body.roll_no, body.course, body.branch, body.year),
        )
        student = cur.fetchone()

    # Auto-create a ₹0 balance billing plan so the student is immediately scannable
    today = date.today()
    plan_end = today + timedelta(days=365)
    create_plan(
        student_id=student["id"],
        installment_amount=0,
        plan_start=str(today),
        plan_end=str(plan_end),
        low_balance_threshold=500,
    )

    qr_base64 = generate_qr_base64(student["id"])
    return {
        "success": True,
        "data": {**dict(student), "qr_base64": qr_base64},
    }


@router.get("")
def list_students(_: dict = Depends(require_admin)):
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                s.id, s.name, s.roll_no, s.course, s.branch, s.year, s.created_at,
                bp.balance,
                bp.plan_end,
                bp.is_active AS has_active_plan
            FROM students s
            LEFT JOIN billing_plans bp
                ON bp.student_id = s.id AND bp.is_active = TRUE
            ORDER BY s.name
            """
        )
        students = cur.fetchall()
    return {"success": True, "data": [dict(s) for s in students]}


@router.get("/{student_id}/full")
def get_student_full(student_id: int, _: dict = Depends(require_admin)):
    """
    Single endpoint that returns ALL student data needed for the detail page:
    student info + active plan + last 30 meal entries + all billing plans + last 50 transactions + QR.
    Reduces 5 round-trips to 1.
    """
    with get_cursor() as cur:
        # Student + active plan
        cur.execute("SELECT * FROM students WHERE id = %s", (student_id,))
        student = cur.fetchone()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        cur.execute(
            "SELECT * FROM billing_plans WHERE student_id = %s AND is_active = TRUE LIMIT 1",
            (student_id,),
        )
        active_plan = cur.fetchone()

        # Last 30 meal entries
        cur.execute(
            """
            SELECT me.id, me.meal_type, me.entry_time, me.amount_deducted,
                   u.username AS recorded_by
            FROM meal_entry me
            LEFT JOIN users u ON u.id = me.recorded_by
            WHERE me.student_id = %s
            ORDER BY me.entry_time DESC
            LIMIT 30
            """,
            (student_id,),
        )
        entries = cur.fetchall()

        # All billing plans
        cur.execute(
            "SELECT * FROM billing_plans WHERE student_id = %s ORDER BY created_at DESC",
            (student_id,),
        )
        plans = cur.fetchall()

        # Last 50 transactions
        cur.execute(
            """
            SELECT * FROM billing_transactions
            WHERE student_id = %s
            ORDER BY created_at DESC
            LIMIT 50
            """,
            (student_id,),
        )
        transactions = cur.fetchall()

    qr_base64 = generate_qr_base64(student_id)

    return {
        "success": True,
        "data": {
            "student": {**dict(student), "active_plan": dict(active_plan) if active_plan else None},
            "entries": [dict(e) for e in entries],
            "plans": [dict(p) for p in plans],
            "transactions": [dict(t) for t in transactions],
            "qr_base64": qr_base64,
        },
    }


@router.get("/{student_id}")
def get_student(student_id: int, _: dict = Depends(require_admin)):
    with get_cursor() as cur:
        cur.execute("SELECT * FROM students WHERE id = %s", (student_id,))
        student = cur.fetchone()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        cur.execute(
            "SELECT * FROM billing_plans WHERE student_id = %s AND is_active = TRUE LIMIT 1",
            (student_id,),
        )
        active_plan = cur.fetchone()

    return {
        "success": True,
        "data": {**dict(student), "active_plan": dict(active_plan) if active_plan else None},
    }


@router.get("/{student_id}/qr")
def get_student_qr(student_id: int, _: dict = Depends(get_current_user)):
    with get_cursor() as cur:
        cur.execute("SELECT id FROM students WHERE id = %s", (student_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Student not found")

    qr_base64 = generate_qr_base64(student_id)
    return {"success": True, "data": {"student_id": student_id, "qr_base64": qr_base64}}

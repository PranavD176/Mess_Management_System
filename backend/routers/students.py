"""
routers/students.py — Student registration, listing, detail
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import date, timedelta
import json
import os
from pathlib import Path
from database import get_cursor
from auth import require_admin, get_current_user, hash_password
from services.qr_service import generate_qr_base64
from services.billing_service import create_plan

router = APIRouter()


def save_student_credentials_to_json(roll_no: str, student_name: str):
    """
    Save student credentials to users_credentials.json file.
    Username and password are both the roll number.
    """
    credentials_file = Path(__file__).parent.parent / "users_credentials.json"
    
    # Load existing credentials or create new structure
    if credentials_file.exists():
        with open(credentials_file, 'r', encoding='utf-8') as f:
            credentials_data = json.load(f)
    else:
        credentials_data = []
    
    # Check if student already exists in the file
    existing_student = next((s for s in credentials_data if s.get("username") == roll_no and s.get("role") == "student"), None)
    
    if not existing_student:
        # Add new student credentials
        student_credential = {
            "username": roll_no,
            "password": roll_no,
            "role": "student"
        }
        credentials_data.append(student_credential)
        
        # Save back to file
        with open(credentials_file, 'w', encoding='utf-8') as f:
            json.dump(credentials_data, f, indent=2, ensure_ascii=False)


class RegisterStudentRequest(BaseModel):
    name: str
    roll_no: str
    course: str
    branch: str = None
    year: int


@router.post("")
def register_student(
    body: RegisterStudentRequest,
):
    roll_no = body.roll_no.strip()
    if not roll_no:
        raise HTTPException(status_code=400, detail="Roll number is required")

    # Public registration - requires approval
    # Validate course
    valid_courses = ['B.Tech', 'M.Tech', 'MCA', 'Diploma']
    if body.course not in valid_courses:
        raise HTTPException(status_code=400, detail=f"Invalid course. Must be one of: {', '.join(valid_courses)}")
    
    # Validate branch requirement
    if body.course in ['B.Tech', 'Diploma', 'M.Tech', 'MCA'] and not body.branch:
        raise HTTPException(status_code=400, detail="Branch is required for B.Tech, M.Tech, MCA and Diploma courses")
    
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
        cur.execute("SELECT id FROM students WHERE LOWER(roll_no) = LOWER(%s)", (roll_no,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Roll number already registered")

        cur.execute(
            """
            INSERT INTO students (name, roll_no, course, branch, year, is_approved)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, name, roll_no, course, branch, year, is_approved, created_at
            """,
            (body.name, roll_no, body.course, body.branch, body.year, False),
        )
        student = cur.fetchone()

    # Don't create billing plan or user credentials until approved
    # QR code will be generated after approval
    
    return {
        "success": True,
        "message": "Registration submitted successfully. Please wait for admin approval.",
        "data": {**dict(student)},
    }


@router.post("/admin")
def register_student_admin(
    body: RegisterStudentRequest,
    _: dict = Depends(require_admin)
):
    roll_no = body.roll_no.strip()
    if not roll_no:
        raise HTTPException(status_code=400, detail="Roll number is required")

    # Admin registration - immediate approval and full setup
    # Validate course
    valid_courses = ['B.Tech', 'M.Tech', 'MCA', 'Diploma']
    if body.course not in valid_courses:
        raise HTTPException(status_code=400, detail=f"Invalid course. Must be one of: {', '.join(valid_courses)}")
    
    # Validate branch requirement
    if body.course in ['B.Tech', 'Diploma', 'M.Tech', 'MCA'] and not body.branch:
        raise HTTPException(status_code=400, detail="Branch is required for B.Tech, M.Tech, MCA and Diploma courses")
    
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
        cur.execute("SELECT id FROM students WHERE LOWER(roll_no) = LOWER(%s)", (roll_no,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Roll number already registered")

        cur.execute(
            """
            INSERT INTO students (name, roll_no, course, branch, year, is_approved)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, name, roll_no, course, branch, year, is_approved, created_at
            """,
            (body.name, roll_no, body.course, body.branch, body.year, True),
        )
        student = cur.fetchone()

    # Don't auto-create billing plan for new students
    # Plans should be created explicitly when payment is received

    # Create user credentials
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (username, password, role)
            VALUES (%s, %s, 'student')
            ON CONFLICT (username) DO NOTHING
            """,
            (roll_no, hash_password(roll_no))
        )

    # Save credentials to JSON file
    save_student_credentials_to_json(roll_no, body.name)

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
                s.id, s.name, s.roll_no, s.course, s.branch, s.year, s.is_approved, s.created_at,
                bp.balance,
                bp.plan_end,
                bp.is_active AS has_active_plan
            FROM students s
            LEFT JOIN billing_plans bp
                ON bp.student_id = s.id AND bp.is_active = TRUE
            WHERE s.is_approved = TRUE
            ORDER BY s.created_at DESC
            """
        )
        students = cur.fetchall()
    return {"success": True, "data": [dict(s) for s in students]}


@router.get("/pending")
def get_pending_registrations(_: dict = Depends(require_admin)):
    """Get all pending student registrations for admin approval"""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, name, roll_no, course, branch, year, created_at
            FROM students 
            WHERE is_approved = FALSE
            ORDER BY created_at DESC
            """
        )
        pending = cur.fetchall()
    return {"success": True, "data": [dict(s) for s in pending]}


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
            "SELECT * FROM billing_plans WHERE student_id = %s AND is_active = TRUE ORDER BY created_at DESC",
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


@router.get("/me")
def get_current_student_data(current_user: dict = Depends(get_current_user)):
    """
    Get current logged-in student's full data.
    Only accessible by students (role-based access).
    """
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="This endpoint is for students only")
    
    # Find student by username (which is the roll number for students)
    with get_cursor() as cur:
        cur.execute("SELECT id FROM students WHERE LOWER(roll_no) = LOWER(%s)", (current_user["username"],))
        student_row = cur.fetchone()
        if not student_row:
            raise HTTPException(status_code=404, detail="Student not found")
        
        student_id = student_row["id"]
        
        # Get full student data using existing endpoint logic
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
            "SELECT * FROM billing_plans WHERE student_id = %s AND is_active = TRUE ORDER BY created_at DESC",
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




@router.post("/{student_id}/approve")
def approve_student_registration(student_id: int, _: dict = Depends(require_admin)):
    """Approve a student registration and create login credentials"""
    with get_cursor() as cur:
        # Check if student exists and is not already approved
        cur.execute(
            "SELECT id, name, roll_no, is_approved FROM students WHERE id = %s", 
            (student_id,)
        )
        student = cur.fetchone()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        if student["is_approved"]:
            raise HTTPException(status_code=400, detail="Student already approved")
        
        # Approve the student
        cur.execute(
            "UPDATE students SET is_approved = TRUE WHERE id = %s",
            (student_id,)
        )
        
        # Don't auto-create billing plan on approval
        # Plans should be created explicitly when payment is received
        
        # Create user credentials
        cur.execute(
            """
            INSERT INTO users (username, password, role)
            VALUES (%s, %s, 'student')
            ON CONFLICT (username) DO NOTHING
            """,
            (student["roll_no"].strip(), hash_password(student["roll_no"].strip()))
        )
    
    # Save credentials to JSON file
    save_student_credentials_to_json(student["roll_no"], student["name"])
    
    # Generate QR code
    qr_base64 = generate_qr_base64(student_id)
    
    return {
        "success": True,
        "message": f"Student {student['name']} approved successfully",
        "data": {
            **dict(student),
            "is_approved": True,
            "qr_base64": qr_base64,
            "login_info": {
                "username": student["roll_no"],
                "password": student["roll_no"]
            }
        }
    }


@router.post("/{student_id}/reject")
def reject_student_registration(student_id: int, _: dict = Depends(require_admin)):
    """Reject a student registration"""
    with get_cursor() as cur:
        # Check if student exists
        cur.execute(
            "SELECT id, name, roll_no FROM students WHERE id = %s", 
            (student_id,)
        )
        student = cur.fetchone()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        # Delete the student record
        cur.execute("DELETE FROM students WHERE id = %s", (student_id,))
    
    return {
        "success": True,
        "message": f"Student {student['name']} registration rejected"
    }

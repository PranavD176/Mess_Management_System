"""
routers/meals.py — QR scan + meal reports

The scan endpoint is fully atomic: slot check, duplicate check, billing plan
lock, meal INSERT, and balance deduction all happen in one database transaction.
This prevents partial commits (meal logged but billing not deducted, or vice versa).
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from auth import require_staff_or_admin, require_admin, get_current_user
from database import get_cursor

router = APIRouter()

IST_OFFSET = timedelta(hours=5, minutes=30)


class ScanRequest(BaseModel):
    student_id: str  # accepts numeric DB id OR any roll_no format


# ── Scan ─────────────────────────────────────────────────────────────────────

@router.post("/scan")
def scan_meal(body: ScanRequest, current_user: dict = Depends(require_staff_or_admin)):
    now_ist = datetime.now(timezone.utc) + IST_OFFSET
    current_time = now_ist.time()
    today = now_ist.date()

    with get_cursor() as cur:
        # ── 1. Find active meal slot ──────────────────────────────────────
        cur.execute(
            "SELECT * FROM meal_slots WHERE start_time <= %s AND end_time >= %s LIMIT 1",
            (current_time, current_time),
        )
        slot = cur.fetchone()
        if not slot:
            raise HTTPException(
                status_code=400,
                detail="No active meal slot right now. Check meal timings in the database.",
            )

        meal_type = slot["meal_type"]
        rate = int(slot["rate"])

        # ── 2. Verify student — accept DB id OR roll_no ──────────────────
        try:
            id_as_int = int(body.student_id)
        except ValueError:
            id_as_int = -1  # impossible db id — roll_no path only

        cur.execute(
            "SELECT id, name FROM students WHERE id = %s OR roll_no = %s",
            (id_as_int, body.student_id.strip()),
        )
        student = cur.fetchone()
        if not student:
            raise HTTPException(
                status_code=404,
                detail=f"No student found with ID or roll number '{body.student_id}'.",
            )
        # Use the real DB id for all downstream queries
        real_id = student["id"]
        # ── 3. Duplicate check ────────────────────────────────────────────
        cur.execute(
            "SELECT id FROM meal_entry WHERE student_id = %s AND meal_type = %s AND entry_date = %s",
            (real_id, meal_type, today),
        )
        if cur.fetchone():
            raise HTTPException(
                status_code=409,
                detail=f"{student['name']} has already been scanned for {meal_type} today.",
            )

        # ── 4. Lock billing plan row (pessimistic) ────────────────────────
        cur.execute(
            "SELECT * FROM billing_plans WHERE student_id = %s AND is_active = TRUE FOR UPDATE",
            (real_id,),
        )
        plan = cur.fetchone()

        # ── 5. Insert meal entry (atomically with billing update below) ───
        cur.execute(
            """
            INSERT INTO meal_entry (student_id, meal_type, entry_time, entry_date, recorded_by, amount_deducted)
            VALUES (%s, %s, NOW(), %s, %s, %s)
            RETURNING id
            """,
            (real_id, meal_type, today, int(current_user["id"]), rate),
        )
        meal_entry_id = cur.fetchone()["id"]

        # ── 6. Deduct balance (same transaction) ──────────────────────────
        warning = None
        balance_remaining = None
        amount_deducted = 0

        if plan:
            new_balance = int(plan["balance"]) - rate
            threshold   = int(plan.get("low_balance_threshold") or 500)
            amount_deducted = rate
            balance_remaining = new_balance

            cur.execute(
                "UPDATE billing_plans SET balance = %s WHERE id = %s",
                (new_balance, plan["id"]),
            )
            cur.execute(
                """
                INSERT INTO billing_transactions
                    (billing_plan_id, student_id, transaction_type, amount, balance_after, meal_entry_id)
                VALUES (%s, %s, 'deduction', %s, %s, %s)
                """,
                (plan["id"], real_id, -rate, new_balance, meal_entry_id),
            )

            if new_balance <= 0:
                warning = f"Balance exhausted (₹{new_balance}). Please renew the plan."
            elif new_balance < threshold:
                warning = f"Low balance: ₹{new_balance} remaining."
        else:
            warning = "No active billing plan. Meal recorded but no amount was deducted."

    # Transaction committed here — all or nothing ─────────────────────────────
    return {
        "success": True,
        "data": {
            "student_name": student["name"],
            "meal_type": meal_type,
            "amount_deducted": amount_deducted,
            "balance_remaining": balance_remaining,
            "warning": warning,
        },
    }


# ── Reports ───────────────────────────────────────────────────────────────────

@router.get("/report/daily")
def daily_report(
    date: str = Query(..., description="YYYY-MM-DD"),
    _: dict = Depends(require_admin),
):
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT 
                s.id AS student_id,
                s.name AS student_name,
                s.roll_no,
                COUNT(me.id) AS scan_count,
                SUM(me.amount_deducted) AS total_amount,
                (COUNT(me.id)::float / 3) AS avg_meals_divided_by_3
            FROM students s
            LEFT JOIN meal_entry me ON s.id = me.student_id AND me.entry_date = %s
            WHERE me.id IS NOT NULL
            GROUP BY s.id, s.name, s.roll_no
            ORDER BY total_amount DESC
            """,
            (date,),
        )
        by_student = cur.fetchall()

        cur.execute(
            "SELECT COUNT(*) AS total_entries, SUM(amount_deducted) AS grand_total FROM meal_entry WHERE entry_date = %s",
            (date,),
        )
        totals = cur.fetchone()

    return {
        "success": True,
        "data": {
            "date": date,
            "by_student": [dict(r) for r in by_student],
            "total_entries": totals["total_entries"],
            "grand_total": int(totals["grand_total"] or 0),
        },
    }


@router.get("/report/monthly")
def monthly_report(
    month: int = Query(..., ge=1, le=12),
    year: int  = Query(..., ge=2020),
    _: dict = Depends(require_admin),
):
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                s.id AS student_id, s.name, s.roll_no,
                COUNT(me.id)           AS total_meals,
                SUM(me.amount_deducted) AS total_amount
            FROM students s
            LEFT JOIN meal_entry me
                ON me.student_id = s.id
               AND EXTRACT(MONTH FROM me.entry_date) = %s
               AND EXTRACT(YEAR  FROM me.entry_date) = %s
            GROUP BY s.id, s.name, s.roll_no
            ORDER BY total_meals DESC NULLS LAST
            """,
            (month, year),
        )
        rows = cur.fetchall()

    return {
        "success": True,
        "data": {"month": month, "year": year, "students": [dict(r) for r in rows]},
    }


@router.get("/history/{student_id}")
def meal_history(student_id: int, _: dict = Depends(require_admin)):
    with get_cursor() as cur:
        cur.execute("SELECT name FROM students WHERE id = %s", (student_id,))
        student = cur.fetchone()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

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

    return {
        "success": True,
        "data": {
            "student_id": student_id,
            "student_name": student["name"],
            "entries": [dict(e) for e in entries],
        },
    }


# ── Attendance Calendar ───────────────────────────────────────────────────────

def _build_attendance_response(student_id: int, month: int, year: int):
    """Shared helper that builds the attendance calendar data for a student."""
    import calendar

    with get_cursor() as cur:
        # Get student info
        cur.execute("SELECT id, name, roll_no FROM students WHERE id = %s", (student_id,))
        student = cur.fetchone()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        # Get the earliest billing plan start date (for frontend month navigation bounds)
        cur.execute(
            "SELECT MIN(plan_start) AS earliest_start FROM billing_plans WHERE student_id = %s",
            (student_id,),
        )
        plan_row = cur.fetchone()
        earliest_start = plan_row["earliest_start"] if plan_row else None

        # Fetch all meal entries for the requested month
        cur.execute(
            """
            SELECT entry_date, meal_type
            FROM meal_entry
            WHERE student_id = %s
              AND EXTRACT(MONTH FROM entry_date) = %s
              AND EXTRACT(YEAR  FROM entry_date) = %s
            ORDER BY entry_date, meal_type
            """,
            (student_id, month, year),
        )
        rows = cur.fetchall()

    # Build per-day mapping: { "2026-05-01": ["breakfast", "lunch"], ... }
    days = {}
    for r in rows:
        d = str(r["entry_date"])
        if d not in days:
            days[d] = []
        days[d].append(r["meal_type"])

    # Monthly summary
    total_days_in_month = calendar.monthrange(year, month)[1]
    days_present = len(days)
    breakfast_count = sum(1 for meals in days.values() if "breakfast" in meals)
    lunch_count     = sum(1 for meals in days.values() if "lunch" in meals)
    dinner_count    = sum(1 for meals in days.values() if "dinner" in meals)
    total_meals     = sum(len(meals) for meals in days.values())

    return {
        "student_id": student["id"],
        "student_name": student["name"],
        "student_roll_no": student["roll_no"],
        "month": month,
        "year": year,
        "earliest_plan_start": str(earliest_start) if earliest_start else None,
        "days": days,
        "summary": {
            "total_days_in_month": total_days_in_month,
            "days_present": days_present,
            "total_meals": total_meals,
            "breakfast_count": breakfast_count,
            "lunch_count": lunch_count,
            "dinner_count": dinner_count,
            "attendance_pct": round((days_present / total_days_in_month) * 100, 1) if total_days_in_month else 0,
        },
    }


@router.get("/attendance/{student_id}")
def get_student_attendance(
    student_id: int,
    month: int = Query(..., ge=1, le=12),
    year: int  = Query(..., ge=2020),
    _: dict = Depends(require_admin),
):
    """Admin endpoint: get a student's attendance calendar for a given month."""
    data = _build_attendance_response(student_id, month, year)
    return {"success": True, "data": data}


@router.get("/my-attendance")
def get_my_attendance(
    month: int = Query(..., ge=1, le=12),
    year: int  = Query(..., ge=2020),
    current_user: dict = Depends(get_current_user),
):
    """Student endpoint: get own attendance calendar for a given month."""
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="This endpoint is for students only")

    with get_cursor() as cur:
        cur.execute(
            "SELECT id FROM students WHERE LOWER(roll_no) = LOWER(%s)",
            (current_user["username"],),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Student not found")
        student_id = row["id"]

    data = _build_attendance_response(student_id, month, year)
    return {"success": True, "data": data}


def _build_yearly_attendance_response(student_id: int, academic_year: int):
    """
    Build attendance data for a full academic year (July of academic_year to June of academic_year+1).
    Returns per-month summaries and a yearly aggregate.
    """
    import calendar as cal_mod
    from datetime import date

    with get_cursor() as cur:
        cur.execute("SELECT id, name, roll_no FROM students WHERE id = %s", (student_id,))
        student = cur.fetchone()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        start_date = date(academic_year, 7, 1)
        end_date   = date(academic_year + 1, 6, 30)

        cur.execute(
            """
            SELECT entry_date, meal_type
            FROM meal_entry
            WHERE student_id = %s
              AND entry_date >= %s
              AND entry_date <= %s
            ORDER BY entry_date, meal_type
            """,
            (student_id, start_date, end_date),
        )
        rows = cur.fetchall()

    # Build per-day mapping across the whole year
    all_days = {}
    for r in rows:
        d = str(r["entry_date"])
        if d not in all_days:
            all_days[d] = []
        all_days[d].append(r["meal_type"])

    # Build per-month summaries
    # Academic year months: July(7)..Dec(12) of academic_year, Jan(1)..June(6) of academic_year+1
    months = []
    for m in range(7, 13):
        months.append((academic_year, m))
    for m in range(1, 7):
        months.append((academic_year + 1, m))

    monthly_data = []
    yearly_days_present = 0
    yearly_total_meals = 0
    yearly_breakfast = 0
    yearly_lunch = 0
    yearly_dinner = 0
    yearly_total_days = 0

    for (yr, mo) in months:
        days_in_month = cal_mod.monthrange(yr, mo)[1]
        yearly_total_days += days_in_month
        mm = f"{mo:02d}"

        month_days = {}
        for d_num in range(1, days_in_month + 1):
            key = f"{yr}-{mm}-{d_num:02d}"
            if key in all_days:
                month_days[key] = all_days[key]

        dp = len(month_days)
        bc = sum(1 for meals in month_days.values() if "breakfast" in meals)
        lc = sum(1 for meals in month_days.values() if "lunch" in meals)
        dc = sum(1 for meals in month_days.values() if "dinner" in meals)
        tm = sum(len(meals) for meals in month_days.values())

        yearly_days_present += dp
        yearly_total_meals += tm
        yearly_breakfast += bc
        yearly_lunch += lc
        yearly_dinner += dc

        monthly_data.append({
            "year": yr,
            "month": mo,
            "days": month_days,
            "summary": {
                "total_days_in_month": days_in_month,
                "days_present": dp,
                "total_meals": tm,
                "breakfast_count": bc,
                "lunch_count": lc,
                "dinner_count": dc,
                "attendance_pct": round((dp / days_in_month) * 100, 1) if days_in_month else 0,
            },
        })

    return {
        "student_id": student["id"],
        "student_name": student["name"],
        "student_roll_no": student["roll_no"],
        "academic_year": academic_year,
        "academic_year_label": f"July {academic_year} – June {academic_year + 1}",
        "months": monthly_data,
        "yearly_summary": {
            "total_days": yearly_total_days,
            "days_present": yearly_days_present,
            "total_meals": yearly_total_meals,
            "breakfast_count": yearly_breakfast,
            "lunch_count": yearly_lunch,
            "dinner_count": yearly_dinner,
            "attendance_pct": round((yearly_days_present / yearly_total_days) * 100, 1) if yearly_total_days else 0,
        },
    }


@router.get("/attendance-yearly/{student_id}")
def get_student_yearly_attendance(
    student_id: int,
    academic_year: int = Query(..., ge=2020, description="Start year of academic year (e.g. 2025 for July 2025 – June 2026)"),
    _: dict = Depends(require_admin),
):
    """Admin endpoint: get a student's attendance for a full academic year."""
    data = _build_yearly_attendance_response(student_id, academic_year)
    return {"success": True, "data": data}


@router.get("/my-attendance-yearly")
def get_my_yearly_attendance(
    academic_year: int = Query(..., ge=2020, description="Start year of academic year (e.g. 2025 for July 2025 – June 2026)"),
    current_user: dict = Depends(get_current_user),
):
    """Student endpoint: get own attendance for a full academic year."""
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="This endpoint is for students only")

    with get_cursor() as cur:
        cur.execute(
            "SELECT id FROM students WHERE LOWER(roll_no) = LOWER(%s)",
            (current_user["username"],),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Student not found")
        student_id = row["id"]

    data = _build_yearly_attendance_response(student_id, academic_year)
    return {"success": True, "data": data}

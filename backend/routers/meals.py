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
        rate = float(slot["rate"])

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
        amount_deducted = 0.0

        if plan:
            new_balance = float(plan["balance"]) - rate
            threshold   = float(plan.get("low_balance_threshold") or 500)
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
                warning = f"Balance exhausted (₹{new_balance:.2f}). Please renew the plan."
            elif new_balance < threshold:
                warning = f"Low balance: ₹{new_balance:.2f} remaining."
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
            "grand_total": float(totals["grand_total"] or 0),
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

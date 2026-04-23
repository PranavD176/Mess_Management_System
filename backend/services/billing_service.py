"""
services/billing_service.py — Core billing logic:
  - Deduct meal cost from active plan
  - Carry-forward on plan renewal
  - Log all transactions
"""
from database import get_cursor
from typing import Optional


LOW_BALANCE_DEFAULT = 500


def get_active_plan(student_id: int) -> Optional[dict]:
    """Return the student's active billing plan or None."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM billing_plans WHERE student_id = %s AND is_active = TRUE LIMIT 1",
            (student_id,),
        )
        return cur.fetchone()


def deduct_meal_cost(
    student_id: int,
    meal_entry_id: int,
    meal_type: str,
    rate: int,
) -> dict:
    """
    Deduct `rate` from the student's active billing plan.
    Logs a 'deduction' transaction.
    Returns: { balance_remaining, warning }
    """
    with get_cursor() as cur:
        # Lock the row for update
        cur.execute(
            "SELECT * FROM billing_plans WHERE student_id = %s AND is_active = TRUE FOR UPDATE",
            (student_id,),
        )
        plan = cur.fetchone()

        if not plan:
            # No active plan — record entry but return warning
            return {"balance_remaining": None, "warning": "No active billing plan found."}

        new_balance = int(plan["balance"]) - rate

        # Update balance
        cur.execute(
            "UPDATE billing_plans SET balance = %s WHERE id = %s",
            (new_balance, plan["id"]),
        )

        # Log transaction
        cur.execute(
            """
            INSERT INTO billing_transactions
                (billing_plan_id, student_id, transaction_type, amount, balance_after, meal_entry_id)
            VALUES (%s, %s, 'deduction', %s, %s, %s)
            """,
            (plan["id"], student_id, -rate, new_balance, meal_entry_id),
        )

    # Determine warning — negative means student is in debt
    threshold = int(plan.get("low_balance_threshold") or 500)
    warning = None
    if new_balance < 0:
        warning = f"Outstanding: ₹{abs(new_balance)} owed. Please make payment soon."
    elif new_balance < threshold:
        warning = f"Low balance: ₹{new_balance} remaining."

    return {"balance_remaining": new_balance, "warning": warning}


def create_plan(
    student_id: int,
    installment_amount: int,
    plan_start: str,
    plan_end: str,
    low_balance_threshold: int = LOW_BALANCE_DEFAULT,
) -> dict:
    """
    Create a new billing plan for a student.
    Deactivates any previous active plan first.
    Returns the created plan row.
    """
    with get_cursor() as cur:
        # Deactivate existing plan (if any)
        cur.execute(
            "UPDATE billing_plans SET is_active = FALSE WHERE student_id = %s AND is_active = TRUE",
            (student_id,),
        )

        # Create new plan — balance starts at installment_amount (postpaid/credit model)
        # If installment_amount is 0, balance starts at 0.
        cur.execute(
            """
            INSERT INTO billing_plans
                (student_id, installment_amount, balance, plan_start, plan_end, low_balance_threshold, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, TRUE)
            RETURNING *
            """,
            (student_id, installment_amount, installment_amount, plan_start, plan_end, low_balance_threshold),
        )
        plan = cur.fetchone()

        # Log plan creation transaction
        cur.execute(
            """
            INSERT INTO billing_transactions
                (billing_plan_id, student_id, transaction_type, amount, balance_after, note)
            VALUES (%s, %s, 'installment', %s, %s, 'Plan activated')
            """,
            (plan["id"], student_id, installment_amount, installment_amount),
        )

    return dict(plan)


def renew_plan(
    student_id: int,
    new_installment_amount: int,
    new_plan_end: str,
    low_balance_threshold: int = LOW_BALANCE_DEFAULT,
    plan_start: str = None,
) -> dict:
    """
    Renew a student's billing plan:
    1. Read carry-forward balance from old active plan
    2. Deactivate old plan
    3. Create new plan with new_installment + carry_forward
    4. Log carry_forward transaction
    Returns: { new_plan, carry_forward_amount }
    """
    with get_cursor() as cur:
        # Get current active plan
        cur.execute(
            "SELECT * FROM billing_plans WHERE student_id = %s AND is_active = TRUE FOR UPDATE",
            (student_id,),
        )
        old_plan = cur.fetchone()

        carry_forward = int(old_plan["balance"]) if old_plan else 0
        new_balance = new_installment_amount + carry_forward
        # Use old plan's end_date as new plan start, or provided plan_start, or today
        if old_plan:
            new_start = old_plan["plan_end"]
        else:
            from datetime import date
            new_start = plan_start if plan_start else date.today().isoformat()

        if old_plan:
            cur.execute(
                "UPDATE billing_plans SET is_active = FALSE WHERE id = %s",
                (old_plan["id"],),
            )

        # Create new plan
        cur.execute(
            """
            INSERT INTO billing_plans
                (student_id, installment_amount, balance, plan_start, plan_end, low_balance_threshold, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, TRUE)
            RETURNING *
            """,
            (student_id, new_installment_amount, new_balance, new_start, new_plan_end, low_balance_threshold),
        )
        new_plan = cur.fetchone()

        # Log installment transaction
        cur.execute(
            """
            INSERT INTO billing_transactions
                (billing_plan_id, student_id, transaction_type, amount, balance_after, note)
            VALUES (%s, %s, 'installment', %s, %s, 'Plan renewal installment')
            """,
            (new_plan["id"], student_id, new_installment_amount, new_balance),
        )

        # Log carry-forward if applicable
        if carry_forward > 0 and old_plan:
            cur.execute(
                """
                INSERT INTO billing_transactions
                    (billing_plan_id, student_id, transaction_type, amount, balance_after, note)
                VALUES (%s, %s, 'carry_forward', %s, %s, %s)
                """,
                (
                    new_plan["id"],
                    student_id,
                    carry_forward,
                    new_balance,
                    f"Carry forward from plan #{old_plan['id']}",
                ),
            )

    return {"new_plan": dict(new_plan), "carry_forward_amount": carry_forward}

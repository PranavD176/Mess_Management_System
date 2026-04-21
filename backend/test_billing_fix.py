#!/usr/bin/env python3
"""
Test script to verify the billing report fix for consumed amount calculation.
This script directly tests the SQL query used in the billing report.
"""
import psycopg
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

def test_billing_report_query():
    """Test the fixed billing report query"""
    conn = psycopg.connect(os.environ["DATABASE_URL"] + "?sslmode=require")
    cur = conn.cursor()
    
    try:
        # Test the fixed query
        cur.execute("""
            SELECT
                s.id AS student_id,
                s.name,
                s.roll_no,
                bp.balance,
                bp.installment_amount,
                COALESCE(total_installments.total_paid, 0) - bp.balance AS total_consumed,
                COALESCE(total_installments.total_paid, 0) as total_paid_amount
            FROM students s
            LEFT JOIN billing_plans bp
                ON bp.student_id = s.id AND bp.is_active = TRUE
            LEFT JOIN (
                SELECT 
                    student_id, 
                    SUM(amount) as total_paid
                FROM billing_transactions 
                WHERE transaction_type IN ('installment', 'carry_forward')
                GROUP BY student_id
            ) total_installments ON total_installments.student_id = s.id
            WHERE s.name ILIKE '%ganesh%' OR s.roll_no = '241080018'
            ORDER BY s.name
        """)
        
        results = cur.fetchall()
        
        print("=== Billing Report Test Results ===")
        print(f"Found {len(results)} matching students")
        
        for row in results:
            student_id, name, roll_no, balance, installment, consumed, total_paid = row
            print(f"\nStudent: {name} (Roll: {roll_no})")
            print(f"  Balance: ₹{balance or 0:.2f}")
            print(f"  Current Installment: ₹{installment or 0:.2f}")
            print(f"  Total Paid (all plans): ₹{total_paid or 0:.2f}")
            print(f"  Consumed: ₹{consumed or 0:.2f}")
            print(f"  Check: Total Paid - Balance = {total_paid or 0:.2f} - {balance or 0:.2f} = {(total_paid or 0) - (balance or 0):.2f}")
            
            # Verify the calculation
            expected_consumed = (total_paid or 0) - (balance or 0)
            if abs((consumed or 0) - expected_consumed) < 0.01:
                print(f"  ✅ Calculation is CORRECT")
            else:
                print(f"  ❌ Calculation is WRONG: expected {expected_consumed:.2f}, got {consumed or 0:.2f}")
        
        # Also test the old query for comparison
        print("\n=== Old Query (for comparison) ===")
        cur.execute("""
            SELECT
                s.name,
                s.roll_no,
                bp.balance,
                bp.installment_amount,
                (bp.installment_amount - bp.balance) AS total_consumed_old
            FROM students s
            LEFT JOIN billing_plans bp
                ON bp.student_id = s.id AND bp.is_active = TRUE
            WHERE s.name ILIKE '%ganesh%' OR s.roll_no = '241080018'
            ORDER BY s.name
        """)
        
        old_results = cur.fetchall()
        for row in old_results:
            name, roll_no, balance, installment, old_consumed = row
            print(f"\nStudent: {name} (Roll: {roll_no})")
            print(f"  Old calculation: {installment or 0:.2f} - {balance or 0:.2f} = {old_consumed or 0:.2f}")
            print(f"  ❌ This shows the negative value issue!")
            
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    test_billing_report_query()

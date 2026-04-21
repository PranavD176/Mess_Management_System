#!/usr/bin/env python3
"""
Test script to verify the consumed amount calculation fix.
This script tests the new logic that only counts meal deductions.
"""
import psycopg
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

def test_consumed_calculation():
    """Test the fixed consumed amount calculation"""
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
                COALESCE(meal_consumed.total_spent, 0) AS total_consumed,
                COALESCE(meal_consumed.total_spent, 0) as total_spent_amount
            FROM students s
            LEFT JOIN billing_plans bp
                ON bp.student_id = s.id AND bp.is_active = TRUE
            LEFT JOIN (
                SELECT 
                    student_id, 
                    SUM(ABS(amount)) as total_spent
                FROM billing_transactions 
                WHERE transaction_type = 'deduction'
                GROUP BY student_id
            ) meal_consumed ON meal_consumed.student_id = s.id
            WHERE s.name ILIKE '%ganesh%' OR s.roll_no = '241080018'
            ORDER BY s.name
        """)
        
        results = cur.fetchall()
        
        print("=== Fixed Consumed Calculation Test Results ===")
        print(f"Found {len(results)} matching students")
        
        for row in results:
            student_id, name, roll_no, balance, installment, consumed, total_spent = row
            print(f"\nStudent: {name} (Roll: {roll_no})")
            print(f"  Balance: ₹{balance or 0:.2f}")
            print(f"  Current Installment: ₹{installment or 0:.2f}")
            print(f"  Total Spent on Meals: ₹{total_spent or 0:.2f}")
            print(f"  Consumed: ₹{consumed or 0:.2f}")
            
            # Verify the calculation
            if abs((consumed or 0) - (total_spent or 0)) < 0.01:
                print(f"  ✅ Calculation is CORRECT - consumed matches meal spending")
            else:
                print(f"  ❌ Calculation is WRONG: expected {total_spent or 0:.2f}, got {consumed or 0:.2f}")
        
        # Also check the actual meal transactions for verification
        print("\n=== Actual Meal Transactions ===")
        cur.execute("""
            SELECT 
                s.name,
                s.roll_no,
                COUNT(*) as meal_count,
                SUM(ABS(bt.amount)) as total_meal_cost
            FROM students s
            JOIN billing_transactions bt ON bt.student_id = s.id
            WHERE bt.transaction_type = 'deduction' 
            AND (s.name ILIKE '%ganesh%' OR s.roll_no = '241080018')
            GROUP BY s.id, s.name, s.roll_no
        """)
        
        meal_results = cur.fetchall()
        for row in meal_results:
            name, roll_no, meal_count, total_cost = row
            print(f"\nStudent: {name} (Roll: {roll_no})")
            print(f"  Number of meals: {meal_count}")
            print(f"  Total meal cost: ₹{total_cost:.2f}")
            print(f"  Average per meal: ₹{total_cost/meal_count:.2f}" if meal_count > 0 else "  Average per meal: ₹0.00")
            
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    test_consumed_calculation()

#!/usr/bin/env python3
"""
Test script to check student plan status data
"""
import psycopg
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

def test_student_status():
    """Check student plan status data"""
    conn = psycopg.connect(os.environ["DATABASE_URL"] + "?sslmode=require")
    cur = conn.cursor()
    
    try:
        # Check students without plans
        cur.execute("""
            SELECT s.name, s.roll_no, bp.id AS plan_id, bp.balance, bp.is_active
            FROM students s 
            LEFT JOIN billing_plans bp ON bp.student_id = s.id AND bp.is_active = TRUE 
            WHERE bp.id IS NULL
            ORDER BY s.name
            LIMIT 5
        """)
        
        no_plan_students = cur.fetchall()
        print("Students without plans:")
        for row in no_plan_students:
            name, roll_no, plan_id, balance, is_active = row
            print(f"  {name} (Roll: {roll_no}): Plan ID: {plan_id}, Balance: {balance}, Active: {is_active}")
        
        # Check students with plans
        cur.execute("""
            SELECT s.name, s.roll_no, bp.id AS plan_id, bp.balance, bp.is_active
            FROM students s 
            LEFT JOIN billing_plans bp ON bp.student_id = s.id AND bp.is_active = TRUE 
            WHERE bp.id IS NOT NULL
            ORDER BY s.name
            LIMIT 5
        """)
        
        with_plan_students = cur.fetchall()
        print("\nStudents with plans:")
        for row in with_plan_students:
            name, roll_no, plan_id, balance, is_active = row
            print(f"  {name} (Roll: {roll_no}): Plan ID: {plan_id}, Balance: {balance}, Active: {is_active}")
            
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    test_student_status()

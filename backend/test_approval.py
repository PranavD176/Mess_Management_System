import psycopg
import os
from dotenv import load_dotenv
from auth import hash_password

load_dotenv()

try:
    conn = psycopg.connect(os.getenv('DATABASE_URL'))
    cur = conn.cursor()
    
    # Test approving a pending student (ID: 11, Roll: 13242)
    student_id = 11
    roll_no = "13242"
    
    print(f"Testing approval for student ID: {student_id}")
    
    # Get student info
    cur.execute("SELECT name, roll_no, is_approved FROM students WHERE id = %s", (student_id,))
    student = cur.fetchone()
    
    if not student:
        print("Student not found")
        exit()
    
    print(f"Student: {student[0]}, Roll: {student[1]}, Current Status: {student[2]}")
    
    if student[2]:
        print("Student is already approved")
        exit()
    
    # Approve the student
    cur.execute("UPDATE students SET is_approved = TRUE WHERE id = %s", (student_id,))
    
    # Create user credentials
    cur.execute(
        """
        INSERT INTO users (username, password, role)
        VALUES (%s, %s, 'student')
        ON CONFLICT (username) DO NOTHING
        """,
        (roll_no, hash_password(roll_no))
    )
    
    # Create billing plan
    from datetime import date, timedelta
    from services.billing_service import create_plan
    
    today = date.today()
    plan_end = today + timedelta(days=365)
    create_plan(
        student_id=student_id,
        installment_amount=0,
        plan_start=str(today),
        plan_end=str(plan_end),
        low_balance_threshold=500,
    )
    
    conn.commit()
    
    # Verify the approval
    cur.execute("SELECT is_approved FROM students WHERE id = %s", (student_id,))
    new_status = cur.fetchone()[0]
    
    print(f"New approval status: {new_status}")
    
    # Check if user account was created
    cur.execute("SELECT username, role FROM users WHERE username = %s", (roll_no,))
    user = cur.fetchone()
    
    if user:
        print(f"User account created: {user[0]}, Role: {user[1]}")
    else:
        print("User account not found")
    
    conn.close()
    print("Approval test completed successfully!")
    
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()

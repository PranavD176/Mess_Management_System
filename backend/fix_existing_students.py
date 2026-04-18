import psycopg
import os
from dotenv import load_dotenv

load_dotenv()

try:
    conn = psycopg.connect(os.getenv('DATABASE_URL'))
    cur = conn.cursor()
    
    # Approve all existing students who have user accounts
    cur.execute("""
        UPDATE students 
        SET is_approved = TRUE 
        WHERE roll_no IN (SELECT username FROM users WHERE role = 'student')
    """)
    conn.commit()
    
    # Check the result
    cur.execute('SELECT COUNT(*) FROM students WHERE is_approved = TRUE')
    approved_count = cur.fetchone()[0]
    
    cur.execute('SELECT COUNT(*) FROM students WHERE is_approved = FALSE')
    pending_count = cur.fetchone()[0]
    
    print(f'Approved students: {approved_count}')
    print(f'Pending students: {pending_count}')
    
    # Show recent students with status
    cur.execute('SELECT id, name, roll_no, is_approved, created_at FROM students ORDER BY created_at DESC LIMIT 10')
    students = cur.fetchall()
    print('\nRecent students:')
    for student in students:
        status = 'APPROVED' if student[3] else 'PENDING'
        print(f'  ID: {student[0]}, Name: {student[1]}, Roll: {student[2]}, Status: {status}')
    
    conn.close()
    print('\nFixed existing students successfully!')
    
except Exception as e:
    print(f'Error: {e}')

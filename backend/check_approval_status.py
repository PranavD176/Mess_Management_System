import psycopg
import os
from dotenv import load_dotenv

load_dotenv()

try:
    conn = psycopg.connect(os.getenv('DATABASE_URL'))
    cur = conn.cursor()
    
    # Check recent registrations
    cur.execute('SELECT id, name, roll_no, is_approved, created_at FROM students ORDER BY created_at DESC LIMIT 10')
    students = cur.fetchall()
    print('Recent students:')
    for student in students:
        status = 'APPROVED' if student[3] else 'PENDING'
        print(f'  ID: {student[0]}, Name: {student[1]}, Roll: {student[2]}, Status: {status}, Created: {student[4]}')
    
    # Check if there are any user accounts for these students
    cur.execute('SELECT username, role FROM users WHERE role = %s ORDER BY created_at DESC LIMIT 5', ('student',))
    users = cur.fetchall()
    print('\nRecent student user accounts:')
    for user in users:
        print(f'  Username: {user[0]}, Role: {user[1]}')
    
    conn.close()
    
except Exception as e:
    print(f'Error: {e}')

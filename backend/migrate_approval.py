import psycopg
import os
from dotenv import load_dotenv

load_dotenv()

try:
    conn = psycopg.connect(os.getenv('DATABASE_URL'))
    cur = conn.cursor()
    
    # Add approval status column
    cur.execute('ALTER TABLE students ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE')
    conn.commit()
    
    # Add index
    cur.execute('CREATE INDEX IF NOT EXISTS idx_students_approval ON students(is_approved)')
    conn.commit()
    
    # Update existing students to be approved
    cur.execute('UPDATE students SET is_approved = TRUE WHERE is_approved IS NULL')
    conn.commit()
    
    # Check results
    cur.execute('SELECT COUNT(*) FROM students WHERE is_approved = FALSE')
    pending_count = cur.fetchone()[0]
    print(f'Pending students count: {pending_count}')
    
    cur.execute('SELECT id, name, roll_no, is_approved FROM students ORDER BY created_at DESC LIMIT 5')
    students = cur.fetchall()
    print('Recent students:')
    for student in students:
        print(f'  ID: {student[0]}, Name: {student[1]}, Roll: {student[2]}, Approved: {student[3]}')
    
    conn.close()
    print('Database migration completed successfully!')
    
except Exception as e:
    print(f'Error: {e}')

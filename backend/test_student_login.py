import requests
import json

# Test login for an approved student
login_data = {
    "username": "TESTPUB001",  # This student was approved
    "password": "TESTPUB001"   # Should be roll number as password
}

try:
    print(f"Testing login for approved student: {login_data['username']}")
    
    # Test login
    login_response = requests.post(
        "http://localhost:8000/auth/login",
        json=login_data,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Login Status Code: {login_response.status_code}")
    print(f"Login Response: {login_response.text}")
    
    if login_response.status_code == 200:
        data = login_response.json()
        print(f"✅ Login successful!")
        print(f"Token received: {data.get('data', {}).get('token', 'No token')[:20]}...")
        print(f"User role: {data.get('data', {}).get('role', 'No role')}")
    else:
        print(f"❌ Login failed with status: {login_response.status_code}")
        print(f"Error details: {login_response.text}")
        
except Exception as e:
    print(f"Request failed: {e}")

# Also check if this student exists in database and is approved
print("\n" + "="*50)
print("Checking student status in database...")

try:
    import psycopg
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    conn = psycopg.connect(os.getenv('DATABASE_URL'))
    cur = conn.cursor()
    
    # Check if student exists and is approved
    cur.execute(
        "SELECT id, name, roll_no, is_approved FROM students WHERE roll_no = %s",
        (login_data['username'],)
    )
    student = cur.fetchone()
    
    if student:
        print(f"Student found in database:")
        print(f"  ID: {student[0]}")
        print(f"  Name: {student[1]}")
        print(f"  Roll No: {student[2]}")
        print(f"  Approved: {student[3]}")
        
        # Check if user account exists
        cur.execute(
            "SELECT username, role FROM users WHERE username = %s",
            (login_data['username'],)
        )
        user = cur.fetchone()
        
        if user:
            print(f"  User account exists: {user[0]} (Role: {user[1]})")
        else:
            print(f"  ❌ User account NOT found in users table")
    else:
        print(f"❌ Student NOT found in database")
    
    conn.close()
    
except Exception as e:
    print(f"Database check failed: {e}")

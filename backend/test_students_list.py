import requests
import json

# First, get an admin token by logging in
login_data = {
    "username": "admin",
    "password": "admin@123"
}

try:
    # Login to get token
    login_response = requests.post(
        "http://localhost:8000/auth/login",
        json=login_data,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Login Status: {login_response.status_code}")
    
    if login_response.status_code == 200:
        token = login_response.json()["data"]["token"]
        print(f"Got token: {token[:20]}...")
        
        # Now test the students list endpoint
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        students_response = requests.get(
            "http://localhost:8000/students",
            headers=headers
        )
        
        print(f"\nStudents List Status: {students_response.status_code}")
        
        if students_response.status_code == 200:
            data = students_response.json()
            students = data.get("data", [])
            
            print(f"Total students returned: {len(students)}")
            
            # Check approval status of each student
            approved_count = 0
            pending_count = 0
            
            for student in students:
                if student.get("is_approved"):
                    approved_count += 1
                    print(f"  ✓ APPROVED: {student['name']} ({student['roll_no']})")
                else:
                    pending_count += 1
                    print(f"  ⏳ PENDING: {student['name']} ({student['roll_no']})")
            
            print(f"\nSummary: {approved_count} approved, {pending_count} pending")
            
            if pending_count == 0:
                print("✅ SUCCESS: Students list only shows approved students!")
            else:
                print("❌ ISSUE: Students list still shows pending students")
        else:
            print(f"Error getting students: {students_response.status_code}")
    else:
        print(f"Login failed: {login_response.text}")
        
except Exception as e:
    print(f"Request failed: {e}")

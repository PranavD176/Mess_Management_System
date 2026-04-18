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
        
        # Now test the pending students endpoint
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        pending_response = requests.get(
            "http://localhost:8000/students/pending",
            headers=headers
        )
        
        print(f"\nPending Students Status: {pending_response.status_code}")
        print(f"Pending Students Response: {pending_response.text}")
        
        if pending_response.status_code == 200:
            data = pending_response.json()
            pending_count = len(data.get("data", []))
            print(f"Found {pending_count} pending students")
            
            for student in data.get("data", []):
                print(f"  - {student['name']} ({student['roll_no']})")
        else:
            print(f"Error getting pending students: {pending_response.status_code}")
    else:
        print(f"Login failed: {login_response.text}")
        
except Exception as e:
    print(f"Request failed: {e}")

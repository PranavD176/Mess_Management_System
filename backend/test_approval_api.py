import requests
import json

# Login to get admin token
login_data = {
    "username": "admin",
    "password": "admin@123"
}

try:
    # Login
    login_response = requests.post(
        "http://localhost:8000/auth/login",
        json=login_data,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Login Status: {login_response.status_code}")
    
    if login_response.status_code == 200:
        token = login_response.json()["data"]["token"]
        print(f"Got admin token")
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Test approving a student (ID: 13)
        approve_response = requests.post(
            "http://localhost:8000/students/13/approve",
            headers=headers
        )
        
        print(f"\nApprove Status: {approve_response.status_code}")
        print(f"Approve Response: {approve_response.text}")
        
        if approve_response.status_code == 200:
            data = approve_response.json()
            print(f"Approval successful: {data.get('message')}")
            print(f"Student approved: {data.get('data', {}).get('name')}")
            
            # Check if QR code was generated
            if 'qr_base64' in data.get('data', {}):
                print("QR code generated successfully")
            else:
                print("No QR code found")
        else:
            print(f"Approval failed: {approve_response.status_code}")
            
        # Test pending students again to see if count decreased
        pending_response = requests.get(
            "http://localhost:8000/students/pending",
            headers=headers
        )
        
        if pending_response.status_code == 200:
            pending_count = len(pending_response.json().get("data", []))
            print(f"\nRemaining pending students: {pending_count}")
    else:
        print(f"Login failed: {login_response.text}")
        
except Exception as e:
    print(f"Request failed: {e}")

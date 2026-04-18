import requests
import json

# Test login for an approved student
login_data = {
    "username": "TESTPUB001",
    "password": "TESTPUB001"
}

try:
    print(f"Testing login for: {login_data['username']}")
    
    # Test login
    login_response = requests.post(
        "http://localhost:8000/auth/login",
        json=login_data,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Status Code: {login_response.status_code}")
    print(f"Headers: {dict(login_response.headers)}")
    
    if login_response.status_code != 200:
        print(f"Error Response: {login_response.text}")
    else:
        try:
            data = login_response.json()
            print(f"Success Response: {json.dumps(data, indent=2)}")
        except json.JSONDecodeError as e:
            print(f"JSON Decode Error: {e}")
            print(f"Raw Response: {login_response.text}")
        
except Exception as e:
    print(f"Request failed: {e}")
    import traceback
    traceback.print_exc()

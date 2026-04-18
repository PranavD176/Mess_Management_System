import requests
import json

# Test the public registration endpoint
registration_data = {
    "name": "Test Public Student",
    "roll_no": "TESTPUB001",
    "course": "B.Tech",
    "branch": "CS",
    "year": 1
}

try:
    response = requests.post(
        "http://localhost:8000/students",
        json=registration_data,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Success! Student registered: {data}")
        print(f"Message: {data.get('message', 'No message')}")
    else:
        print(f"Error: {response.status_code} - {response.text}")
        
except Exception as e:
    print(f"Request failed: {e}")

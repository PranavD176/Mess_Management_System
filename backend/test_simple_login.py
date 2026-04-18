import requests

# Test login for admin (should work)
admin_login_data = {
    "username": "admin",
    "password": "admin@123"
}

try:
    print("Testing admin login...")
    response = requests.post(
        "http://localhost:8000/auth/login",
        json=admin_login_data,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Admin Login Status: {response.status_code}")
    print(f"Admin Login Response: {response.text}")
    
    if response.status_code == 200:
        print("✅ Admin login works!")
    else:
        print("❌ Admin login failed!")
        
except Exception as e:
    print(f"Admin login test failed: {e}")

print("\n" + "="*50)
print("Now testing student login...")

# Test login for approved student
student_login_data = {
    "username": "TESTPUB001",
    "password": "TESTPUB001"
}

try:
    print(f"Testing student login: {student_login_data['username']}")
    response = requests.post(
        "http://localhost:8000/auth/login",
        json=student_login_data,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Student Login Status: {response.status_code}")
    print(f"Student Login Response: {response.text}")
    
    if response.status_code == 200:
        print("✅ Student login works!")
    else:
        print("❌ Student login failed!")
        print(f"Error details: {response.text}")
        
except Exception as e:
    print(f"Student login test failed: {e}")

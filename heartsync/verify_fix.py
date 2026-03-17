#!/usr/bin/env python3
"""
Quick verification test for the fixed GET /api/stories endpoint
"""

import requests
import random

BASE_URL = "https://bpm-social.preview.emergentagent.com/api"

# Register test user  
email = f"verification.{random.randint(1000, 9999)}@test.com"
user_data = {
    "email": email,
    "password": "TestPassword123!",
    "name": "Verification User",
    "age": 25
}

response = requests.post(f"{BASE_URL}/auth/register", json=user_data)
token = response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Test the previously failing endpoint
print("Testing GET /api/stories endpoint...")
response = requests.get(f"{BASE_URL}/stories", headers=headers)

if response.status_code == 200:
    stories = response.json()
    print(f"✅ SUCCESS: GET /api/stories returned {len(stories)} story groups")
    print("✅ FIXED: The endpoint that was returning 500 error is now working!")
else:
    print(f"❌ FAILED: {response.status_code} - {response.text}")
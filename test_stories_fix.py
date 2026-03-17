#!/usr/bin/env python3
"""
Test the fixed GET /api/stories endpoint
"""

import requests
import random

BASE_URL = "https://bpm-social.preview.emergentagent.com/api"

def test_stories_fix():
    # Register test user
    email = f"test.stories.{random.randint(1000, 9999)}@test.com"
    user_data = {
        "email": email,
        "password": "TestPassword123!",
        "name": "Test User Stories",
        "age": 25,
        "city": "Milano"
    }
    
    response = requests.post(f"{BASE_URL}/auth/register", json=user_data)
    if response.status_code != 200:
        print(f"❌ Registration failed: {response.status_code}")
        return False
    
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create a story
    story_data = {
        "media_url": "https://example.com/test-story.jpg",
        "media_type": "image",
        "caption": "Test story for fix validation"
    }
    
    response = requests.post(f"{BASE_URL}/stories", json=story_data, headers=headers)
    if response.status_code != 200:
        print(f"❌ Story creation failed: {response.status_code}")
        return False
    
    print(f"✅ Story created successfully")
    
    # Test GET /api/stories (the previously failing endpoint)
    response = requests.get(f"{BASE_URL}/stories", headers=headers)
    if response.status_code == 200:
        stories = response.json()
        if isinstance(stories, list):
            print(f"✅ GET /api/stories working: {len(stories)} users with stories")
            return True
        else:
            print(f"❌ Invalid response format")
            return False
    else:
        print(f"❌ GET /api/stories failed: {response.status_code} - {response.text}")
        return False

if __name__ == "__main__":
    success = test_stories_fix()
    print("✅ Stories endpoint fix verified!" if success else "❌ Stories endpoint still has issues")
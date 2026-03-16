#!/usr/bin/env python3
"""
BPM Social Dating App - Backend Authentication System Tests
Tests all authentication API endpoints with various scenarios.
"""

import requests
import json
import uuid
import os
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = "https://bpm-social.preview.emergentagent.com/api"

class BPMAuthTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.test_results = {
            "passed": 0,
            "failed": 0,
            "errors": []
        }
        self.test_user_email = f"testuser_{uuid.uuid4().hex[:8]}@example.com"
        self.test_user_password = "SecurePass123!"
        self.test_user_name = "Maria Rossi"
        self.auth_token = None
        self.user_id = None
        
    def log_result(self, test_name, success, message="", error=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if message:
            print(f"    {message}")
        if error:
            print(f"    Error: {error}")
            self.test_results["errors"].append(f"{test_name}: {error}")
        
        if success:
            self.test_results["passed"] += 1
        else:
            self.test_results["failed"] += 1
        print()
    
    def test_user_registration(self):
        """Test POST /api/auth/register - User registration"""
        print("=== Testing User Registration ===")
        
        # Test 1: Valid registration
        payload = {
            "email": self.test_user_email,
            "password": self.test_user_password,
            "name": self.test_user_name,
            "age": 25,
            "bio": "Test user for BPM Social",
            "city": "Milano",
            "interests": ["music", "travel", "fitness"]
        }
        
        try:
            response = requests.post(f"{self.base_url}/auth/register", json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.auth_token = data["access_token"]
                    self.user_id = data["user"]["id"]
                    self.log_result("Valid user registration", True, 
                                  f"User created with ID: {self.user_id}")
                else:
                    self.log_result("Valid user registration", False, 
                                  "Response missing required fields", 
                                  f"Response: {data}")
            else:
                self.log_result("Valid user registration", False, 
                              f"Expected 200, got {response.status_code}", 
                              response.text)
        except Exception as e:
            self.log_result("Valid user registration", False, error=str(e))
        
        # Test 2: Duplicate email registration (should fail)
        try:
            response = requests.post(f"{self.base_url}/auth/register", json=payload, timeout=10)
            
            if response.status_code == 400:
                self.log_result("Duplicate email registration", True, 
                              "Correctly rejected duplicate email")
            else:
                self.log_result("Duplicate email registration", False, 
                              f"Expected 400, got {response.status_code}", 
                              response.text)
        except Exception as e:
            self.log_result("Duplicate email registration", False, error=str(e))
        
        # Test 3: Registration without required fields
        invalid_payload = {"email": f"invalid_{uuid.uuid4().hex[:8]}@example.com"}
        
        try:
            response = requests.post(f"{self.base_url}/auth/register", json=invalid_payload, timeout=10)
            
            if response.status_code in [400, 422]:
                self.log_result("Registration without required fields", True, 
                              "Correctly rejected incomplete data")
            else:
                self.log_result("Registration without required fields", False, 
                              f"Expected 400/422, got {response.status_code}", 
                              response.text)
        except Exception as e:
            self.log_result("Registration without required fields", False, error=str(e))
    
    def test_user_login(self):
        """Test POST /api/auth/login - User login"""
        print("=== Testing User Login ===")
        
        # Test 1: Valid login
        payload = {
            "email": self.test_user_email,
            "password": self.test_user_password
        }
        
        try:
            response = requests.post(f"{self.base_url}/auth/login", json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.auth_token = data["access_token"]
                    self.log_result("Valid login", True, 
                                  f"Login successful, token received")
                else:
                    self.log_result("Valid login", False, 
                                  "Response missing required fields", 
                                  f"Response: {data}")
            else:
                self.log_result("Valid login", False, 
                              f"Expected 200, got {response.status_code}", 
                              response.text)
        except Exception as e:
            self.log_result("Valid login", False, error=str(e))
        
        # Test 2: Invalid email login
        invalid_payload = {
            "email": "nonexistent@example.com",
            "password": self.test_user_password
        }
        
        try:
            response = requests.post(f"{self.base_url}/auth/login", json=invalid_payload, timeout=10)
            
            if response.status_code == 401:
                self.log_result("Invalid email login", True, 
                              "Correctly rejected invalid email")
            else:
                self.log_result("Invalid email login", False, 
                              f"Expected 401, got {response.status_code}", 
                              response.text)
        except Exception as e:
            self.log_result("Invalid email login", False, error=str(e))
        
        # Test 3: Wrong password login
        wrong_password_payload = {
            "email": self.test_user_email,
            "password": "WrongPassword123!"
        }
        
        try:
            response = requests.post(f"{self.base_url}/auth/login", json=wrong_password_payload, timeout=10)
            
            if response.status_code == 401:
                self.log_result("Wrong password login", True, 
                              "Correctly rejected wrong password")
            else:
                self.log_result("Wrong password login", False, 
                              f"Expected 401, got {response.status_code}", 
                              response.text)
        except Exception as e:
            self.log_result("Wrong password login", False, error=str(e))
    
    def test_protected_route_me(self):
        """Test GET /api/auth/me - Get current authenticated user"""
        print("=== Testing Protected Route /auth/me ===")
        
        # Test 1: Access with valid token
        if self.auth_token:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            try:
                response = requests.get(f"{self.base_url}/auth/me", headers=headers, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if "id" in data and "email" in data:
                        self.log_result("Access /auth/me with valid token", True, 
                                      f"User data retrieved: {data['email']}")
                    else:
                        self.log_result("Access /auth/me with valid token", False, 
                                      "Response missing required user fields", 
                                      f"Response: {data}")
                else:
                    self.log_result("Access /auth/me with valid token", False, 
                                  f"Expected 200, got {response.status_code}", 
                                  response.text)
            except Exception as e:
                self.log_result("Access /auth/me with valid token", False, error=str(e))
        else:
            self.log_result("Access /auth/me with valid token", False, 
                          "No valid token available from previous tests")
        
        # Test 2: Access without token
        try:
            response = requests.get(f"{self.base_url}/auth/me", timeout=10)
            
            if response.status_code == 401 or response.status_code == 403:
                self.log_result("Access /auth/me without token", True, 
                              "Correctly rejected request without token")
            else:
                self.log_result("Access /auth/me without token", False, 
                              f"Expected 401/403, got {response.status_code}", 
                              response.text)
        except Exception as e:
            self.log_result("Access /auth/me without token", False, error=str(e))
        
        # Test 3: Access with invalid token
        headers = {"Authorization": "Bearer invalid_token_here"}
        
        try:
            response = requests.get(f"{self.base_url}/auth/me", headers=headers, timeout=10)
            
            if response.status_code == 401:
                self.log_result("Access /auth/me with invalid token", True, 
                              "Correctly rejected invalid token")
            else:
                self.log_result("Access /auth/me with invalid token", False, 
                              f"Expected 401, got {response.status_code}", 
                              response.text)
        except Exception as e:
            self.log_result("Access /auth/me with invalid token", False, error=str(e))
    
    def test_profile_update(self):
        """Test PUT /api/auth/profile - Update user profile"""
        print("=== Testing Profile Update ===")
        
        # Test 1: Update profile with valid token
        if self.auth_token:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            update_payload = {
                "name": "Maria Rossi Updated",
                "bio": "Updated bio for BPM Social test user",
                "age": 26,
                "city": "Roma",
                "interests": ["music", "travel", "fitness", "photography"]
            }
            
            try:
                response = requests.put(f"{self.base_url}/auth/profile", 
                                      json=update_payload, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("name") == update_payload["name"] and data.get("bio") == update_payload["bio"]:
                        self.log_result("Update profile with valid token", True, 
                                      "Profile updated successfully")
                    else:
                        self.log_result("Update profile with valid token", False, 
                                      "Profile update did not persist correctly", 
                                      f"Response: {data}")
                else:
                    self.log_result("Update profile with valid token", False, 
                                  f"Expected 200, got {response.status_code}", 
                                  response.text)
            except Exception as e:
                self.log_result("Update profile with valid token", False, error=str(e))
        else:
            self.log_result("Update profile with valid token", False, 
                          "No valid token available from previous tests")
        
        # Test 2: Update profile without token
        update_payload = {"name": "Should Fail"}
        
        try:
            response = requests.put(f"{self.base_url}/auth/profile", json=update_payload, timeout=10)
            
            if response.status_code == 401 or response.status_code == 403:
                self.log_result("Update profile without token", True, 
                              "Correctly rejected request without token")
            else:
                self.log_result("Update profile without token", False, 
                              f"Expected 401/403, got {response.status_code}", 
                              response.text)
        except Exception as e:
            self.log_result("Update profile without token", False, error=str(e))
    
    def test_jwt_token_validation(self):
        """Test JWT token validation and authentication middleware"""
        print("=== Testing JWT Token Validation ===")
        
        # Test 1: Verify token format and structure
        if self.auth_token:
            try:
                # JWT tokens should have 3 parts separated by dots
                token_parts = self.auth_token.split('.')
                if len(token_parts) == 3:
                    self.log_result("JWT token structure", True, 
                                  "Token has correct JWT structure (3 parts)")
                else:
                    self.log_result("JWT token structure", False, 
                                  f"Token has {len(token_parts)} parts, expected 3")
            except Exception as e:
                self.log_result("JWT token structure", False, error=str(e))
        else:
            self.log_result("JWT token structure", False, 
                          "No token available for testing")
        
        # Test 2: Test token persistence across different endpoints
        if self.auth_token:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            # Try accessing both protected endpoints with the same token
            me_success = False
            profile_success = False
            
            try:
                me_response = requests.get(f"{self.base_url}/auth/me", headers=headers, timeout=10)
                me_success = me_response.status_code == 200
                
                profile_response = requests.put(f"{self.base_url}/auth/profile", 
                                              json={"bio": "Token persistence test"}, 
                                              headers=headers, timeout=10)
                profile_success = profile_response.status_code == 200
                
                if me_success and profile_success:
                    self.log_result("Token persistence across endpoints", True, 
                                  "Token works across multiple protected endpoints")
                else:
                    self.log_result("Token persistence across endpoints", False, 
                                  f"/me: {me_response.status_code}, /profile: {profile_response.status_code}")
            except Exception as e:
                self.log_result("Token persistence across endpoints", False, error=str(e))
    
    def run_all_tests(self):
        """Run all authentication tests"""
        print(f"🚀 Starting BPM Social Authentication Tests")
        print(f"Backend URL: {self.base_url}")
        print(f"Test User Email: {self.test_user_email}")
        print("=" * 60)
        
        # Run all test suites
        self.test_user_registration()
        self.test_user_login()
        self.test_protected_route_me()
        self.test_profile_update()
        self.test_jwt_token_validation()
        
        # Print summary
        print("=" * 60)
        print("🏆 TEST RESULTS SUMMARY")
        print("=" * 60)
        print(f"✅ Passed: {self.test_results['passed']}")
        print(f"❌ Failed: {self.test_results['failed']}")
        print(f"📊 Total: {self.test_results['passed'] + self.test_results['failed']}")
        
        if self.test_results['failed'] > 0:
            print("\n🔍 FAILED TESTS:")
            for error in self.test_results['errors']:
                print(f"   • {error}")
        
        success_rate = (self.test_results['passed'] / (self.test_results['passed'] + self.test_results['failed'])) * 100 if (self.test_results['passed'] + self.test_results['failed']) > 0 else 0
        print(f"\n📈 Success Rate: {success_rate:.1f}%")
        
        return self.test_results['failed'] == 0

if __name__ == "__main__":
    tester = BPMAuthTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All authentication tests passed!")
        exit(0)
    else:
        print("\n⚠️  Some tests failed. Check the results above.")
        exit(1)
#!/usr/bin/env python3

import requests
import json
import uuid
from datetime import datetime

# Backend URL from frontend .env
BACKEND_URL = "https://bpm-social.preview.emergentagent.com/api"

# Test user credentials (from FASE 0 testing)
TEST_USER = {
    "email": "anna.bianchi@example.com", 
    "password": "TestPass456!",
    "name": "Anna Bianchi",
    "age": 25
}

class ExtensiveChatTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.token = None
        self.user_id = None
        self.test_match_id = None
        self.session = requests.Session()
        
    def setup_authentication(self):
        """Authenticate user and get token"""
        print("🔐 Setting up authentication for extensive testing...")
        
        # Try to login with existing user
        login_data = {
            "email": TEST_USER["email"],
            "password": TEST_USER["password"]
        }
        
        response = self.session.post(f"{self.base_url}/auth/login", json=login_data)
        
        if response.status_code == 401:
            # User doesn't exist, create it
            print("📝 Creating new test user for extensive testing...")
            create_response = self.session.post(f"{self.base_url}/auth/register", json=TEST_USER)
            
            if create_response.status_code != 200:
                print(f"❌ Failed to create user: {create_response.status_code}")
                return False
            
            response = create_response
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token")
            self.user_id = data.get("user", {}).get("id")
            
            # Set Authorization header for all future requests
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            
            print(f"✅ Authentication successful. User ID: {self.user_id}")
            return True
        else:
            print(f"❌ Authentication failed: {response.status_code}")
            return False
    
    def test_multiple_message_types(self):
        """Test sending different types of messages"""
        print("\n🎯 Testing: Multiple message types")
        
        if not self.test_match_id:
            # Create a match first
            response = self.session.post(f"{self.base_url}/chat/create-test-match")
            if response.status_code == 200:
                self.test_match_id = response.json().get("id")
            else:
                print("❌ Could not create test match for message types test")
                return False
        
        message_types = [
            {"message": "Hi there! How are you?", "message_type": "text"},
            {"message": "😊❤️🔥", "message_type": "text"},
            {"message": "https://giphy.com/embed/3o7qDEq2bMbcbPRQ2c", "message_type": "gif"},
            {"message": "Voice message placeholder", "message_type": "voice"}
        ]
        
        all_passed = True
        for i, msg_data in enumerate(message_types):
            response = self.session.post(
                f"{self.base_url}/chat/{self.test_match_id}/messages", 
                json=msg_data
            )
            
            if response.status_code == 200:
                print(f"✅ Message {i+1} ({msg_data['message_type']}) sent successfully")
            else:
                print(f"❌ Message {i+1} ({msg_data['message_type']}) failed: {response.status_code}")
                all_passed = False
        
        return all_passed
    
    def test_message_persistence_and_ordering(self):
        """Test that messages are properly stored and ordered"""
        print("\n🎯 Testing: Message persistence and ordering")
        
        if not self.test_match_id:
            print("❌ No test match ID available")
            return False
        
        # Get current message count
        response = self.session.get(f"{self.base_url}/chat/{self.test_match_id}/messages")
        if response.status_code != 200:
            print("❌ Failed to get initial message count")
            return False
        
        initial_count = len(response.json())
        
        # Send a few more messages with timestamps we can verify
        test_messages = [
            "Message 1 - First",
            "Message 2 - Second", 
            "Message 3 - Third"
        ]
        
        sent_times = []
        for msg in test_messages:
            before_send = datetime.utcnow()
            response = self.session.post(
                f"{self.base_url}/chat/{self.test_match_id}/messages",
                json={"message": msg, "message_type": "text"}
            )
            after_send = datetime.utcnow()
            
            if response.status_code == 200:
                sent_times.append((before_send, after_send, msg))
            else:
                print(f"❌ Failed to send test message: {msg}")
                return False
        
        # Retrieve messages and verify ordering
        response = self.session.get(f"{self.base_url}/chat/{self.test_match_id}/messages")
        if response.status_code != 200:
            print("❌ Failed to retrieve messages for ordering test")
            return False
        
        messages = response.json()
        if len(messages) < initial_count + len(test_messages):
            print(f"❌ Expected at least {initial_count + len(test_messages)} messages, got {len(messages)}")
            return False
        
        # Check that messages are ordered by timestamp (newest first for this API)
        timestamps = [datetime.fromisoformat(msg['timestamp'].replace('Z', '')) for msg in messages]
        if timestamps != sorted(timestamps, reverse=True):
            print("❌ Messages are not properly ordered by timestamp")
            return False
        
        print(f"✅ Message persistence and ordering verified ({len(messages)} total messages)")
        return True
    
    def test_pagination_edge_cases(self):
        """Test pagination with various limit values"""
        print("\n🎯 Testing: Pagination edge cases")
        
        if not self.test_match_id:
            print("❌ No test match ID available")
            return False
        
        # Test different limit values
        test_cases = [
            {"limit": 1, "should_work": True},
            {"limit": 50, "should_work": True},
            {"limit": 200, "should_work": True},
            {"limit": 201, "should_work": False},  # Above max limit
            {"limit": 0, "should_work": False},    # Invalid limit
            {"limit": -1, "should_work": False}    # Negative limit
        ]
        
        all_passed = True
        for test_case in test_cases:
            response = self.session.get(
                f"{self.base_url}/chat/{self.test_match_id}/messages?limit={test_case['limit']}"
            )
            
            if test_case["should_work"]:
                if response.status_code == 200:
                    messages = response.json()
                    if len(messages) <= test_case["limit"]:
                        print(f"✅ Limit {test_case['limit']} worked correctly")
                    else:
                        print(f"❌ Limit {test_case['limit']} returned too many messages")
                        all_passed = False
                else:
                    print(f"❌ Limit {test_case['limit']} failed unexpectedly: {response.status_code}")
                    all_passed = False
            else:
                if response.status_code in [400, 422]:
                    print(f"✅ Limit {test_case['limit']} correctly rejected")
                else:
                    print(f"❌ Limit {test_case['limit']} should have been rejected, got: {response.status_code}")
                    all_passed = False
        
        return all_passed
    
    def test_match_security(self):
        """Test that users can only access their own matches"""
        print("\n🎯 Testing: Match security")
        
        # Create a second user to test security
        second_user = {
            "email": "test.security@example.com",
            "password": "SecurityTest123!",
            "name": "Security Tester",
            "age": 30
        }
        
        # Create second user
        second_session = requests.Session()
        response = second_session.post(f"{self.base_url}/auth/register", json=second_user)
        
        if response.status_code != 200:
            # Try to login if already exists
            login_response = second_session.post(f"{self.base_url}/auth/login", json={
                "email": second_user["email"], 
                "password": second_user["password"]
            })
            if login_response.status_code != 200:
                print("❌ Could not create/login second user for security test")
                return False
            response = login_response
        
        # Set auth header for second user
        second_token = response.json().get("access_token")
        second_session.headers.update({"Authorization": f"Bearer {second_token}"})
        
        # Second user tries to access first user's match
        if self.test_match_id:
            response = second_session.get(f"{self.base_url}/chat/{self.test_match_id}/messages")
            
            if response.status_code == 403:
                print("✅ Cross-user match access correctly blocked")
            else:
                print(f"❌ Cross-user match access should be blocked, got: {response.status_code}")
                return False
        
        return True
    
    def test_data_validation(self):
        """Test input validation for message content"""
        print("\n🎯 Testing: Data validation")
        
        if not self.test_match_id:
            # Create a match first
            response = self.session.post(f"{self.base_url}/chat/create-test-match")
            if response.status_code == 200:
                self.test_match_id = response.json().get("id")
            else:
                print("❌ Could not create test match for validation test")
                return False
        
        # Test various invalid inputs
        test_cases = [
            {"data": {}, "desc": "empty payload"},
            {"data": {"message_type": "text"}, "desc": "missing message"},
            {"data": {"message": ""}, "desc": "empty message"},
            {"data": {"message": "valid", "message_type": "invalid_type"}, "desc": "invalid message type"},
            {"data": {"message": "A" * 10000}, "desc": "very long message"}  # Test if there are length limits
        ]
        
        all_passed = True
        for test_case in test_cases:
            response = self.session.post(
                f"{self.base_url}/chat/{self.test_match_id}/messages",
                json=test_case["data"]
            )
            
            # Most of these should fail with 422 (validation error) or 400
            if response.status_code in [400, 422]:
                print(f"✅ {test_case['desc']} correctly rejected")
            elif response.status_code == 200 and test_case["desc"] == "very long message":
                print(f"✅ {test_case['desc']} accepted (no length limit)")
            elif response.status_code == 200 and test_case["desc"] == "invalid message type":
                print(f"✅ {test_case['desc']} accepted (flexible message type)")
            else:
                print(f"❌ {test_case['desc']} validation failed: {response.status_code}")
                all_passed = False
        
        return all_passed
    
    def run_extensive_tests(self):
        """Run all extensive chat tests"""
        print("🚀 Starting EXTENSIVE FASE 1 - Real-time Chat Backend Tests")
        print(f"Backend URL: {self.base_url}")
        print("="*70)
        
        results = {}
        
        # Setup
        if not self.setup_authentication():
            print("❌ Authentication setup failed, cannot continue")
            return results
        
        # Extensive Tests
        results["multiple_message_types"] = self.test_multiple_message_types()
        results["message_persistence_ordering"] = self.test_message_persistence_and_ordering()
        results["pagination_edge_cases"] = self.test_pagination_edge_cases()
        results["match_security"] = self.test_match_security()
        results["data_validation"] = self.test_data_validation()
        
        # Summary
        print("\n" + "="*70)
        print("📊 EXTENSIVE CHAT BACKEND TEST SUMMARY")
        print("="*70)
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name:40} {status}")
        
        print(f"\nOverall: {passed}/{total} extensive tests passed")
        
        if passed == total:
            print("🎉 ALL EXTENSIVE CHAT BACKEND TESTS PASSED!")
        else:
            print(f"⚠️  {total - passed} extensive tests failed")
        
        return results

if __name__ == "__main__":
    tester = ExtensiveChatTester()
    tester.run_extensive_tests()
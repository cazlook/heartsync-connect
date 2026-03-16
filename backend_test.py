#!/usr/bin/env python3

import requests
import json
import uuid
from datetime import datetime
import os

# Backend URL from frontend .env
BACKEND_URL = "https://bpm-social.preview.emergentagent.com/api"

# Test user credentials (from FASE 0 testing)
TEST_USER = {
    "email": "marco.rossi@example.com",
    "password": "SecurePass123!",
    "name": "Marco Rossi",
    "age": 28
}

class ChatBackendTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.token = None
        self.user_id = None
        self.test_match_id = None
        self.test_notifications = []
        self.session = requests.Session()
        
    def setup_authentication(self):
        """Authenticate user and get token"""
        print("🔐 Setting up authentication...")
        
        # Try to login with existing user
        login_data = {
            "email": TEST_USER["email"],
            "password": TEST_USER["password"]
        }
        
        response = self.session.post(f"{self.base_url}/auth/login", json=login_data)
        
        if response.status_code == 401:
            # User doesn't exist, create it
            print("📝 User not found, creating new test user...")
            create_response = self.session.post(f"{self.base_url}/auth/register", json=TEST_USER)
            
            if create_response.status_code != 200:
                print(f"❌ Failed to create user: {create_response.status_code}")
                print(f"Response: {create_response.text}")
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
            print(f"Response: {response.text}")
            return False
    
    def test_create_test_match(self):
        """Test POST /api/chat/create-test-match"""
        print("\n🎯 Testing: POST /api/chat/create-test-match")
        
        response = self.session.post(f"{self.base_url}/chat/create-test-match")
        
        if response.status_code == 200:
            data = response.json()
            self.test_match_id = data.get("id")
            print(f"✅ Test match created successfully")
            print(f"   Match ID: {self.test_match_id}")
            print(f"   User1: {data.get('user1_id')}")
            print(f"   User2: {data.get('user2_id')}")
            print(f"   Cardiac Score: {data.get('cardiac_score')}")
            return True
        else:
            print(f"❌ Failed to create test match: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_get_matches(self):
        """Test GET /api/chat/matches"""
        print("\n🎯 Testing: GET /api/chat/matches")
        
        response = self.session.get(f"{self.base_url}/chat/matches")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Retrieved {len(data)} matches")
            for match in data:
                print(f"   Match ID: {match.get('id')}")
                print(f"   Users: {match.get('user1_id')} <-> {match.get('user2_id')}")
                print(f"   Cardiac Score: {match.get('cardiac_score')}")
            return True
        else:
            print(f"❌ Failed to get matches: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_get_messages_empty(self):
        """Test GET /api/chat/{match_id}/messages with empty conversation"""
        print("\n🎯 Testing: GET /api/chat/{match_id}/messages (empty)")
        
        if not self.test_match_id:
            print("❌ No test match ID available")
            return False
        
        response = self.session.get(f"{self.base_url}/chat/{self.test_match_id}/messages")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Retrieved {len(data)} messages (should be 0 for new match)")
            return True
        else:
            print(f"❌ Failed to get messages: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_get_messages_invalid_match(self):
        """Test GET /api/chat/{match_id}/messages with invalid match ID"""
        print("\n🎯 Testing: GET /api/chat/{match_id}/messages (invalid match)")
        
        fake_match_id = str(uuid.uuid4())
        response = self.session.get(f"{self.base_url}/chat/{fake_match_id}/messages")
        
        if response.status_code == 404:
            print("✅ Correctly rejected invalid match ID with 404")
            return True
        else:
            print(f"❌ Expected 404, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_send_message_rest(self):
        """Test POST /api/chat/{match_id}/messages"""
        print("\n🎯 Testing: POST /api/chat/{match_id}/messages")
        
        if not self.test_match_id:
            print("❌ No test match ID available")
            return False
        
        message_data = {
            "message": "Hello! This is a test message via REST API",
            "message_type": "text"
        }
        
        response = self.session.post(
            f"{self.base_url}/chat/{self.test_match_id}/messages", 
            json=message_data
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Message sent successfully via REST")
            print(f"   Message ID: {data.get('id')}")
            print(f"   Sender: {data.get('sender_id')}")
            print(f"   Content: {data.get('message')}")
            print(f"   Timestamp: {data.get('timestamp')}")
            return True
        else:
            print(f"❌ Failed to send message: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_send_message_invalid_match(self):
        """Test POST /api/chat/{match_id}/messages with invalid match"""
        print("\n🎯 Testing: POST /api/chat/{match_id}/messages (invalid match)")
        
        fake_match_id = str(uuid.uuid4())
        message_data = {
            "message": "This should fail",
            "message_type": "text"
        }
        
        response = self.session.post(
            f"{self.base_url}/chat/{fake_match_id}/messages", 
            json=message_data
        )
        
        if response.status_code == 404:
            print("✅ Correctly rejected invalid match ID with 404")
            return True
        else:
            print(f"❌ Expected 404, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_get_messages_with_data(self):
        """Test GET /api/chat/{match_id}/messages after sending a message"""
        print("\n🎯 Testing: GET /api/chat/{match_id}/messages (with data)")
        
        if not self.test_match_id:
            print("❌ No test match ID available")
            return False
        
        response = self.session.get(f"{self.base_url}/chat/{self.test_match_id}/messages")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Retrieved {len(data)} messages")
            for msg in data:
                print(f"   Message: {msg.get('message')}")
                print(f"   From: {msg.get('sender_id')}")
                print(f"   Time: {msg.get('timestamp')}")
            return True
        else:
            print(f"❌ Failed to get messages: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_get_messages_pagination(self):
        """Test GET /api/chat/{match_id}/messages with pagination"""
        print("\n🎯 Testing: GET /api/chat/{match_id}/messages (pagination)")
        
        if not self.test_match_id:
            print("❌ No test match ID available")
            return False
        
        # Test with limit parameter
        response = self.session.get(
            f"{self.base_url}/chat/{self.test_match_id}/messages?limit=10"
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Pagination test passed, retrieved {len(data)} messages with limit=10")
            return True
        else:
            print(f"❌ Failed pagination test: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_unauthorized_access(self):
        """Test chat endpoints without authentication"""
        print("\n🎯 Testing: Unauthorized access (no token)")
        
        # Create new session without token
        unauth_session = requests.Session()
        
        endpoints_to_test = [
            f"{self.base_url}/chat/create-test-match",
            f"{self.base_url}/chat/matches",
        ]
        
        if self.test_match_id:
            endpoints_to_test.extend([
                f"{self.base_url}/chat/{self.test_match_id}/messages",
                f"{self.base_url}/chat/{self.test_match_id}/messages"
            ])
        
        all_passed = True
        for endpoint in endpoints_to_test:
            if "/messages" in endpoint and endpoint.endswith("/messages"):
                # This is a GET request
                response = unauth_session.get(endpoint)
            elif endpoint.endswith("create-test-match"):
                response = unauth_session.post(endpoint)
            elif endpoint.endswith("/messages"):
                # This is a POST request
                response = unauth_session.post(endpoint, json={"message": "test", "message_type": "text"})
            else:
                response = unauth_session.get(endpoint)
            
            if response.status_code in [401, 403]:
                print(f"✅ {endpoint} correctly rejected unauthorized request ({response.status_code})")
            else:
                print(f"❌ {endpoint} should have rejected unauthorized request, got {response.status_code}")
                all_passed = False
        
        return all_passed
    
    def test_socket_io_basic_connectivity(self):
        """Test basic Socket.io connectivity (limited test)"""
        print("\n🎯 Testing: Socket.io basic connectivity")
        
        # For Socket.io testing, we'd need a WebSocket client
        # Since this is limited via curl, we'll just try to access the Socket.io endpoint
        
        try:
            # Check if Socket.io endpoint is accessible
            response = self.session.get(f"{BACKEND_URL.replace('/api', '')}/socket.io/")
            
            if response.status_code == 400 and "Session ID unknown" in response.text:
                print("✅ Socket.io server is running (got expected error for HTTP request)")
                return True
            elif response.status_code == 200:
                print("✅ Socket.io server responded")
                return True
            else:
                print(f"❌ Socket.io server unexpected response: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Socket.io connectivity test failed: {e}")
            return False
    
    # ===== NOTIFICATION TESTS =====
    def test_get_notifications_empty(self):
        """Test GET /api/notifications (empty state)"""
        print("\n🔔 Testing: GET /api/notifications (empty)")
        
        response = self.session.get(f"{self.base_url}/notifications")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Retrieved {len(data)} notifications (empty state OK)")
            return True
        else:
            print(f"❌ Failed to get notifications: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_get_unread_count_empty(self):
        """Test GET /api/notifications/unread-count (empty state)"""
        print("\n🔔 Testing: GET /api/notifications/unread-count (empty)")
        
        response = self.session.get(f"{self.base_url}/notifications/unread-count")
        
        if response.status_code == 200:
            data = response.json()
            count = data.get("count", -1)
            print(f"✅ Unread count: {count} (empty state)")
            return True
        else:
            print(f"❌ Failed to get unread count: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def create_test_notification(self):
        """Helper: Create test notification via direct message sending"""
        print("\n🔔 Creating test notification via message...")
        
        if not self.test_match_id:
            print("❌ No test match ID available for notification test")
            return False
        
        # Send message which should trigger notification system
        message_data = {
            "message": "Test notification message",
            "message_type": "text"
        }
        
        response = self.session.post(
            f"{self.base_url}/chat/{self.test_match_id}/messages",
            json=message_data
        )
        
        if response.status_code == 200:
            print("✅ Test message sent (may create notification)")
            return True
        return False
    
    def test_get_notifications_with_pagination(self):
        """Test GET /api/notifications with pagination params"""
        print("\n🔔 Testing: GET /api/notifications (pagination)")
        
        # Test with limit and skip parameters
        response = self.session.get(f"{self.base_url}/notifications?limit=10&skip=0")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Notifications pagination test passed, got {len(data)} results")
            
            # Store any notifications found for later tests
            self.test_notifications = data
            for notif in data[:2]:  # Store first 2 for testing
                if notif.get('id'):
                    break
            
            return True
        else:
            print(f"❌ Failed notifications pagination: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_mark_notification_read(self):
        """Test PUT /api/notifications/{notification_id}/read"""
        print("\n🔔 Testing: PUT /api/notifications/{notification_id}/read")
        
        # First try to get a notification to mark as read
        if not self.test_notifications:
            response = self.session.get(f"{self.base_url}/notifications")
            if response.status_code == 200:
                self.test_notifications = response.json()
        
        if not self.test_notifications:
            print("⏭️ No notifications found to test mark as read - creating mock test...")
            # Test with fake ID to verify 404 handling
            fake_id = str(uuid.uuid4())
            response = self.session.put(f"{self.base_url}/notifications/{fake_id}/read")
            if response.status_code == 404:
                print("✅ Correctly returned 404 for non-existent notification")
                return True
            else:
                print(f"❌ Expected 404, got {response.status_code}")
                return False
        
        # Test marking existing notification as read
        notification_id = self.test_notifications[0]["id"]
        response = self.session.put(f"{self.base_url}/notifications/{notification_id}/read")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ Successfully marked notification as read")
                return True
        
        print(f"❌ Failed to mark notification as read: {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    def test_mark_notification_read_invalid(self):
        """Test PUT /api/notifications/{notification_id}/read with invalid ID"""
        print("\n🔔 Testing: PUT /api/notifications/{notification_id}/read (invalid ID)")
        
        fake_id = str(uuid.uuid4())
        response = self.session.put(f"{self.base_url}/notifications/{fake_id}/read")
        
        if response.status_code == 404:
            print("✅ Correctly returned 404 for invalid notification ID")
            return True
        else:
            print(f"❌ Expected 404, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_mark_all_notifications_read(self):
        """Test PUT /api/notifications/read-all"""
        print("\n🔔 Testing: PUT /api/notifications/read-all")
        
        response = self.session.put(f"{self.base_url}/notifications/read-all")
        
        if response.status_code == 200:
            data = response.json()
            marked_count = data.get("marked_read", 0)
            print(f"✅ Successfully marked {marked_count} notifications as read")
            return True
        else:
            print(f"❌ Failed to mark all notifications as read: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_delete_notification(self):
        """Test DELETE /api/notifications/{notification_id}"""
        print("\n🔔 Testing: DELETE /api/notifications/{notification_id}")
        
        # Refresh notifications list
        response = self.session.get(f"{self.base_url}/notifications")
        if response.status_code == 200:
            self.test_notifications = response.json()
        
        if not self.test_notifications:
            print("⏭️ No notifications to delete - testing with fake ID...")
            fake_id = str(uuid.uuid4())
            response = self.session.delete(f"{self.base_url}/notifications/{fake_id}")
            if response.status_code == 404:
                print("✅ Correctly returned 404 for non-existent notification")
                return True
            else:
                print(f"❌ Expected 404, got {response.status_code}")
                return False
        
        # Test deleting existing notification
        notification_id = self.test_notifications[0]["id"]
        response = self.session.delete(f"{self.base_url}/notifications/{notification_id}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ Successfully deleted notification")
                return True
        
        print(f"❌ Failed to delete notification: {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    def test_delete_notification_invalid(self):
        """Test DELETE /api/notifications/{notification_id} with invalid ID"""
        print("\n🔔 Testing: DELETE /api/notifications/{notification_id} (invalid ID)")
        
        fake_id = str(uuid.uuid4())
        response = self.session.delete(f"{self.base_url}/notifications/{fake_id}")
        
        if response.status_code == 404:
            print("✅ Correctly returned 404 for invalid notification ID")
            return True
        else:
            print(f"❌ Expected 404, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_register_fcm_token(self):
        """Test POST /api/notifications/register-token"""
        print("\n🔔 Testing: POST /api/notifications/register-token")
        
        token_data = {
            "user_id": self.user_id,
            "token": "test-fcm-token-" + str(uuid.uuid4())[:8],
            "device_type": "web"
        }
        
        response = self.session.post(f"{self.base_url}/notifications/register-token", json=token_data)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ Successfully registered FCM token")
                return True
        
        print(f"❌ Failed to register FCM token: {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    def test_register_fcm_token_update(self):
        """Test POST /api/notifications/register-token (update existing)"""
        print("\n🔔 Testing: POST /api/notifications/register-token (update)")
        
        token_data = {
            "user_id": self.user_id,
            "token": "updated-fcm-token-" + str(uuid.uuid4())[:8],
            "device_type": "android"
        }
        
        response = self.session.post(f"{self.base_url}/notifications/register-token", json=token_data)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ Successfully updated FCM token")
                return True
        
        print(f"❌ Failed to update FCM token: {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    def test_notifications_unauthorized(self):
        """Test notification endpoints without authentication"""
        print("\n🔔 Testing: Unauthorized access to notification endpoints")
        
        # Create new session without token
        unauth_session = requests.Session()
        
        endpoints_to_test = [
            ("GET", f"{self.base_url}/notifications"),
            ("GET", f"{self.base_url}/notifications/unread-count"),
            ("PUT", f"{self.base_url}/notifications/fake-id/read"),
            ("PUT", f"{self.base_url}/notifications/read-all"),
            ("DELETE", f"{self.base_url}/notifications/fake-id"),
            ("POST", f"{self.base_url}/notifications/register-token")
        ]
        
        all_passed = True
        for method, endpoint in endpoints_to_test:
            if method == "GET":
                response = unauth_session.get(endpoint)
            elif method == "POST":
                response = unauth_session.post(endpoint, json={"user_id": "test", "token": "test"})
            elif method == "PUT":
                response = unauth_session.put(endpoint)
            elif method == "DELETE":
                response = unauth_session.delete(endpoint)
            
            if response.status_code in [401, 403]:
                print(f"✅ {method} {endpoint.split('/')[-2:]} correctly rejected unauthorized request")
            else:
                print(f"❌ {method} {endpoint.split('/')[-2:]} should reject unauthorized request, got {response.status_code}")
                all_passed = False
        
        return all_passed

    def run_all_tests(self):
        """Run all backend tests including notifications"""
        print("🚀 Starting FASE 2 - Sistema Notifiche Backend Tests")
        print(f"Backend URL: {self.base_url}")
        print("="*60)
        
        results = {}
        
        # Setup
        if not self.setup_authentication():
            print("❌ Authentication setup failed, cannot continue")
            return results
        
        # Ensure we have test match for notification triggers
        if not self.test_create_test_match():
            print("⚠️ Could not create test match, some notification tests may be limited")
        
        # NOTIFICATION SYSTEM TESTS (FASE 2)
        print("\n" + "="*60)
        print("🔔 FASE 2 - NOTIFICATION SYSTEM TESTS")
        print("="*60)
        
        results["notifications_empty"] = self.test_get_notifications_empty()
        results["notifications_unread_count_empty"] = self.test_get_unread_count_empty()
        results["notifications_pagination"] = self.test_get_notifications_with_pagination()
        results["notification_mark_read"] = self.test_mark_notification_read()
        results["notification_mark_read_invalid"] = self.test_mark_notification_read_invalid()
        results["notifications_mark_all_read"] = self.test_mark_all_notifications_read()
        results["notification_delete"] = self.test_delete_notification()
        results["notification_delete_invalid"] = self.test_delete_notification_invalid()
        results["fcm_token_register"] = self.test_register_fcm_token()
        results["fcm_token_update"] = self.test_register_fcm_token_update()
        results["notifications_unauthorized"] = self.test_notifications_unauthorized()
        
        # PREVIOUS CHAT TESTS (for completeness)
        print("\n" + "="*60)
        print("💬 PREVIOUS - CHAT SYSTEM TESTS")
        print("="*60)
        
        results["get_matches"] = self.test_get_matches()
        results["get_messages_empty"] = self.test_get_messages_empty()
        results["get_messages_invalid_match"] = self.test_get_messages_invalid_match()
        results["send_message_rest"] = self.test_send_message_rest()
        results["send_message_invalid_match"] = self.test_send_message_invalid_match()
        results["get_messages_with_data"] = self.test_get_messages_with_data()
        results["get_messages_pagination"] = self.test_get_messages_pagination()
        results["chat_unauthorized_access"] = self.test_unauthorized_access()
        results["socket_io_connectivity"] = self.test_socket_io_basic_connectivity()
        
        # Summary
        print("\n" + "="*60)
        print("📊 COMPLETE BACKEND TEST SUMMARY")
        print("="*60)
        
        # Separate notification and chat results
        notification_tests = {k: v for k, v in results.items() if k.startswith(("notification", "fcm_token")) or "notifications" in k}
        chat_tests = {k: v for k, v in results.items() if k not in notification_tests}
        
        print("\n🔔 NOTIFICATION TESTS:")
        for test_name, result in notification_tests.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {test_name:35} {status}")
        
        print("\n💬 CHAT TESTS:")
        for test_name, result in chat_tests.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {test_name:35} {status}")
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        notif_passed = sum(1 for result in notification_tests.values() if result)
        notif_total = len(notification_tests)
        
        print(f"\n📊 OVERALL SUMMARY:")
        print(f"Notification Tests: {notif_passed}/{notif_total} passed")
        print(f"Chat Tests: {passed - notif_passed}/{total - notif_total} passed")
        print(f"Total: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL BACKEND TESTS PASSED!")
        else:
            print(f"⚠️  {total - passed} tests failed")
        
        return results

if __name__ == "__main__":
    tester = ChatBackendTester()
    tester.run_all_tests()
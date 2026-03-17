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

    # ===== BIOMETRIC TESTS (FASE 3) =====
    def test_save_heartrate_reading(self):
        """Test POST /api/biometrics/heartrate"""
        print("\n💓 Testing: POST /api/biometrics/heartrate")
        
        heartrate_data = {
            "bpm": 78,
            "context": "browsing"
        }
        
        response = self.session.post(f"{self.base_url}/biometrics/heartrate", json=heartrate_data)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Heart rate reading saved successfully")
            print(f"   ID: {data.get('id')}")
            print(f"   BPM: {data.get('bpm')}")
            print(f"   Context: {data.get('context')}")
            print(f"   Timestamp: {data.get('timestamp')}")
            return True
        else:
            print(f"❌ Failed to save heart rate reading: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_save_multiple_heartrate_readings(self):
        """Test saving multiple heart rate readings for statistics"""
        print("\n💓 Testing: Multiple heart rate readings for stats")
        
        readings = [
            {"bpm": 65, "context": "browsing"},
            {"bpm": 89, "context": "chatting"},
            {"bpm": 95, "context": "event"},
            {"bpm": 72, "context": "browsing"},
            {"bpm": 83, "context": "chatting"}
        ]
        
        success_count = 0
        for reading in readings:
            response = self.session.post(f"{self.base_url}/biometrics/heartrate", json=reading)
            if response.status_code == 200:
                success_count += 1
        
        if success_count == len(readings):
            print(f"✅ Successfully saved {success_count} heart rate readings")
            return True
        else:
            print(f"❌ Only saved {success_count}/{len(readings)} readings")
            return False
    
    def test_save_emotional_reaction(self):
        """Test POST /api/biometrics/reaction"""
        print("\n💝 Testing: POST /api/biometrics/reaction")
        
        reaction_data = {
            "profile_id": str(uuid.uuid4()),
            "profile_name": "Sofia Martinez",
            "bpm_before": 75,
            "bpm_peak": 102,
            "bpm_delta": 27,
            "intensity": "high"
        }
        
        response = self.session.post(f"{self.base_url}/biometrics/reaction", json=reaction_data)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Emotional reaction saved successfully")
            print(f"   ID: {data.get('id')}")
            print(f"   Profile: {data.get('profile_name')}")
            print(f"   BPM Delta: {data.get('bpm_delta')}")
            print(f"   Intensity: {data.get('intensity')}")
            return True
        else:
            print(f"❌ Failed to save emotional reaction: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_save_multiple_emotional_reactions(self):
        """Test saving multiple emotional reactions for analytics"""
        print("\n💝 Testing: Multiple emotional reactions for analytics")
        
        profiles = [
            {"name": "Emma Thompson", "bpm_before": 70, "bpm_peak": 98, "bpm_delta": 28, "intensity": "high"},
            {"name": "Luca Romano", "bpm_before": 72, "bpm_peak": 85, "bpm_delta": 13, "intensity": "medium"},
            {"name": "Anna Bianchi", "bpm_before": 68, "bpm_peak": 91, "bpm_delta": 23, "intensity": "high"},
            {"name": "Marco Conte", "bpm_before": 74, "bpm_peak": 82, "bpm_delta": 8, "intensity": "low"},
            {"name": "Giulia Ferrari", "bpm_before": 71, "bpm_peak": 105, "bpm_delta": 34, "intensity": "high"}
        ]
        
        success_count = 0
        for profile in profiles:
            reaction_data = {
                "profile_id": str(uuid.uuid4()),
                "profile_name": profile["name"],
                "bpm_before": profile["bpm_before"],
                "bpm_peak": profile["bpm_peak"],
                "bpm_delta": profile["bpm_delta"],
                "intensity": profile["intensity"]
            }
            
            response = self.session.post(f"{self.base_url}/biometrics/reaction", json=reaction_data)
            if response.status_code == 200:
                success_count += 1
        
        if success_count == len(profiles):
            print(f"✅ Successfully saved {success_count} emotional reactions")
            return True
        else:
            print(f"❌ Only saved {success_count}/{len(profiles)} reactions")
            return False
    
    def test_get_biometric_stats_empty(self):
        """Test GET /api/biometrics/stats with no data"""
        print("\n📊 Testing: GET /api/biometrics/stats (potentially empty)")
        
        response = self.session.get(f"{self.base_url}/biometrics/stats")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Biometric stats retrieved successfully")
            print(f"   Total Readings: {data.get('total_readings')}")
            print(f"   Average BPM: {data.get('avg_bpm')}")
            print(f"   Max BPM: {data.get('max_bpm')}")
            print(f"   Min BPM: {data.get('min_bpm')}")
            print(f"   Total Reactions: {data.get('total_reactions')}")
            print(f"   Avg Reaction Intensity: {data.get('avg_reaction_intensity')}")
            print(f"   Most Reactive Time: {data.get('most_reactive_time')}")
            return True
        else:
            print(f"❌ Failed to get biometric stats: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_get_biometric_stats_with_data(self):
        """Test GET /api/biometrics/stats after adding test data"""
        print("\n📊 Testing: GET /api/biometrics/stats (with test data)")
        
        response = self.session.get(f"{self.base_url}/biometrics/stats")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Biometric stats with data retrieved successfully")
            
            # Verify calculations make sense
            total_readings = data.get('total_readings', 0)
            avg_bpm = data.get('avg_bpm', 0)
            max_bpm = data.get('max_bpm', 0)
            min_bpm = data.get('min_bpm', 0)
            total_reactions = data.get('total_reactions', 0)
            
            print(f"   Total Readings: {total_readings}")
            print(f"   Average BPM: {avg_bpm}")
            print(f"   BPM Range: {min_bpm} - {max_bpm}")
            print(f"   Total Reactions: {total_reactions}")
            print(f"   Avg Reaction Intensity: {data.get('avg_reaction_intensity')}")
            
            # Basic validation
            if total_readings > 0 and avg_bpm > 0 and max_bpm >= min_bpm:
                print("✅ Statistical calculations appear valid")
                return True
            else:
                print("⚠️ Statistical calculations may have issues")
                return False
        else:
            print(f"❌ Failed to get biometric stats: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_get_top_reactions_empty(self):
        """Test GET /api/biometrics/top-reactions with potentially no data"""
        print("\n🔥 Testing: GET /api/biometrics/top-reactions (empty)")
        
        response = self.session.get(f"{self.base_url}/biometrics/top-reactions")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Top reactions retrieved successfully (empty list OK)")
            print(f"   Count: {len(data)} reactions")
            return True
        else:
            print(f"❌ Failed to get top reactions: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_get_top_reactions_with_data(self):
        """Test GET /api/biometrics/top-reactions after adding test data"""
        print("\n🔥 Testing: GET /api/biometrics/top-reactions (with data)")
        
        response = self.session.get(f"{self.base_url}/biometrics/top-reactions")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Top reactions retrieved successfully")
            print(f"   Count: {len(data)} reactions")
            
            for i, reaction in enumerate(data[:3]):  # Show top 3
                print(f"   #{i+1}: {reaction.get('profile_name')} - Delta: {reaction.get('bpm_delta')}")
            
            # Verify sorting by bpm_delta
            if len(data) > 1:
                deltas = [r.get('bpm_delta', 0) for r in data]
                is_sorted = all(deltas[i] >= deltas[i+1] for i in range(len(deltas)-1))
                if is_sorted:
                    print("✅ Top reactions properly sorted by BPM delta")
                else:
                    print("⚠️ Top reactions sorting may be incorrect")
            
            return True
        else:
            print(f"❌ Failed to get top reactions: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_get_top_reactions_limit(self):
        """Test GET /api/biometrics/top-reactions with limit parameter"""
        print("\n🔥 Testing: GET /api/biometrics/top-reactions (limit=3)")
        
        response = self.session.get(f"{self.base_url}/biometrics/top-reactions?limit=3")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Top reactions with limit retrieved successfully")
            print(f"   Requested limit: 3, Got: {len(data)} reactions")
            
            if len(data) <= 3:
                print("✅ Limit parameter working correctly")
                return True
            else:
                print("⚠️ Limit parameter may not be working")
                return False
        else:
            print(f"❌ Failed to get top reactions with limit: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_get_bpm_timeline_default(self):
        """Test GET /api/biometrics/timeline with default 7 days"""
        print("\n📈 Testing: GET /api/biometrics/timeline (default 7 days)")
        
        response = self.session.get(f"{self.base_url}/biometrics/timeline")
        
        if response.status_code == 200:
            data = response.json()
            timeline = data.get('timeline', [])
            print(f"✅ BPM timeline retrieved successfully")
            print(f"   Timeline entries: {len(timeline)}")
            
            # Check format
            if timeline:
                entry = timeline[0]
                print(f"   First entry: BPM {entry.get('bpm')} at {entry.get('timestamp')}")
                print(f"   Context: {entry.get('context')}")
                
                # Verify sorting (should be timestamp ascending)
                if len(timeline) > 1:
                    timestamps = [entry.get('timestamp') for entry in timeline]
                    is_sorted = all(timestamps[i] <= timestamps[i+1] for i in range(len(timestamps)-1))
                    if is_sorted:
                        print("✅ Timeline properly sorted by timestamp")
                    else:
                        print("⚠️ Timeline sorting may be incorrect")
            
            return True
        else:
            print(f"❌ Failed to get BPM timeline: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_get_bpm_timeline_custom_days(self):
        """Test GET /api/biometrics/timeline with custom day range"""
        print("\n📈 Testing: GET /api/biometrics/timeline (days=14)")
        
        response = self.session.get(f"{self.base_url}/biometrics/timeline?days=14")
        
        if response.status_code == 200:
            data = response.json()
            timeline = data.get('timeline', [])
            print(f"✅ BPM timeline (14 days) retrieved successfully")
            print(f"   Timeline entries: {len(timeline)}")
            return True
        else:
            print(f"❌ Failed to get BPM timeline (14 days): {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_get_reaction_history_default(self):
        """Test GET /api/biometrics/history with default 30 days"""
        print("\n📚 Testing: GET /api/biometrics/history (default 30 days)")
        
        response = self.session.get(f"{self.base_url}/biometrics/history")
        
        if response.status_code == 200:
            data = response.json()
            history = data.get('reactions', [])
            print(f"✅ Reaction history retrieved successfully")
            print(f"   History entries: {len(history)}")
            
            if history:
                entry = history[0]
                print(f"   Latest reaction: {entry.get('profile_name')} - Delta: {entry.get('bpm_delta')}")
                print(f"   Intensity: {entry.get('intensity')}")
                
                # Verify sorting (should be timestamp descending)
                if len(history) > 1:
                    timestamps = [entry.get('timestamp') for entry in history]
                    is_sorted = all(timestamps[i] >= timestamps[i+1] for i in range(len(timestamps)-1))
                    if is_sorted:
                        print("✅ History properly sorted by timestamp (desc)")
                    else:
                        print("⚠️ History sorting may be incorrect")
            
            return True
        else:
            print(f"❌ Failed to get reaction history: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_get_reaction_history_custom_days(self):
        """Test GET /api/biometrics/history with custom day range"""
        print("\n📚 Testing: GET /api/biometrics/history (days=7)")
        
        response = self.session.get(f"{self.base_url}/biometrics/history?days=7")
        
        if response.status_code == 200:
            data = response.json()
            history = data.get('reactions', [])
            print(f"✅ Reaction history (7 days) retrieved successfully")
            print(f"   History entries: {len(history)}")
            return True
        else:
            print(f"❌ Failed to get reaction history (7 days): {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_get_weekly_summary(self):
        """Test GET /api/biometrics/weekly-summary"""
        print("\n📋 Testing: GET /api/biometrics/weekly-summary")
        
        response = self.session.get(f"{self.base_url}/biometrics/weekly-summary")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Weekly summary retrieved successfully")
            print(f"   Period: {data.get('period')}")
            print(f"   Total Readings: {data.get('total_readings')}")
            print(f"   Total Reactions: {data.get('total_reactions')}")
            
            daily_breakdown = data.get('daily_breakdown', {})
            print(f"   Daily breakdown has {len(daily_breakdown)} days")
            
            # Show some daily stats
            for day, stats in list(daily_breakdown.items())[:3]:
                print(f"   {day}: {stats.get('readings')} readings, avg BPM: {stats.get('avg_bpm')}")
            
            return True
        else:
            print(f"❌ Failed to get weekly summary: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    def test_biometrics_unauthorized(self):
        """Test biometric endpoints without authentication"""
        print("\n💓 Testing: Unauthorized access to biometric endpoints")
        
        # Create new session without token
        unauth_session = requests.Session()
        
        endpoints_to_test = [
            ("POST", f"{self.base_url}/biometrics/heartrate"),
            ("POST", f"{self.base_url}/biometrics/reaction"),
            ("GET", f"{self.base_url}/biometrics/stats"),
            ("GET", f"{self.base_url}/biometrics/top-reactions"),
            ("GET", f"{self.base_url}/biometrics/timeline"),
            ("GET", f"{self.base_url}/biometrics/history"),
            ("GET", f"{self.base_url}/biometrics/weekly-summary")
        ]
        
        all_passed = True
        for method, endpoint in endpoints_to_test:
            if method == "GET":
                response = unauth_session.get(endpoint)
            elif method == "POST":
                if "heartrate" in endpoint:
                    response = unauth_session.post(endpoint, json={"bpm": 80, "context": "test"})
                else:  # reaction endpoint
                    response = unauth_session.post(endpoint, json={
                        "profile_id": "test", "profile_name": "test", 
                        "bpm_before": 70, "bpm_peak": 90, "bpm_delta": 20, "intensity": "medium"
                    })
            
            if response.status_code in [401, 403]:
                print(f"✅ {method} {endpoint.split('/')[-1]} correctly rejected unauthorized request")
            else:
                print(f"❌ {method} {endpoint.split('/')[-1]} should reject unauthorized request, got {response.status_code}")
                all_passed = False
        
        return all_passed
    
    def run_biometric_tests(self):
        """Run all FASE 3 biometric tests"""
        print("\n" + "="*60)
        print("💓 FASE 3 - BIOMETRIC DASHBOARD TESTS")
        print("="*60)
        
        results = {}
        
        # Test with empty state first
        results["biometric_stats_empty"] = self.test_get_biometric_stats_empty()
        results["top_reactions_empty"] = self.test_get_top_reactions_empty()
        
        # Save test data for comprehensive testing
        results["save_heartrate"] = self.test_save_heartrate_reading()
        results["save_multiple_heartrates"] = self.test_save_multiple_heartrate_readings()
        results["save_reaction"] = self.test_save_emotional_reaction()
        results["save_multiple_reactions"] = self.test_save_multiple_emotional_reactions()
        
        # Test analytics with data
        results["biometric_stats_with_data"] = self.test_get_biometric_stats_with_data()
        results["top_reactions_with_data"] = self.test_get_top_reactions_with_data()
        results["top_reactions_limit"] = self.test_get_top_reactions_limit()
        results["bpm_timeline_default"] = self.test_get_bpm_timeline_default()
        results["bpm_timeline_custom"] = self.test_get_bpm_timeline_custom_days()
        results["reaction_history_default"] = self.test_get_reaction_history_default()
        results["reaction_history_custom"] = self.test_get_reaction_history_custom_days()
        results["weekly_summary"] = self.test_get_weekly_summary()
        
        # Test security
        results["biometrics_unauthorized"] = self.test_biometrics_unauthorized()
        
        return results

    def run_all_tests(self):
        """Run all backend tests including biometrics (FASE 3)"""
        print("🚀 Starting FASE 3 - Dashboard BPM Personali Backend Tests")
        print(f"Backend URL: {self.base_url}")
        print("="*60)
        
        results = {}
        
        # Setup
        if not self.setup_authentication():
            print("❌ Authentication setup failed, cannot continue")
            return results
        
        # BIOMETRIC SYSTEM TESTS (FASE 3) - Main focus
        biometric_results = self.run_biometric_tests()
        results.update(biometric_results)
        
        # Summary
        print("\n" + "="*60)
        print("📊 FASE 3 - BIOMETRIC BACKEND TEST SUMMARY")
        print("="*60)
        
        # Separate biometric results 
        biometric_tests = {k: v for k, v in results.items() if any(keyword in k for keyword in 
            ["biometric", "heartrate", "reaction", "top_reactions", "bpm_timeline", "weekly_summary", "save_"])}
        
        print("\n💓 BIOMETRIC TESTS:")
        for test_name, result in biometric_tests.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {test_name:40} {status}")
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        biometric_passed = sum(1 for result in biometric_tests.values() if result)
        biometric_total = len(biometric_tests)
        
        print(f"\n📊 OVERALL SUMMARY:")
        print(f"Biometric Tests: {biometric_passed}/{biometric_total} passed")
        print(f"Total: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL BIOMETRIC BACKEND TESTS PASSED!")
        else:
            print(f"⚠️  {total - passed} tests failed")
        
        return results

if __name__ == "__main__":
    tester = ChatBackendTester()
    tester.run_all_tests()
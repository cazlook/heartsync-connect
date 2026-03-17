#!/usr/bin/env python3

import requests
import json
import uuid
from datetime import datetime
import os

# Backend URL from frontend .env
BACKEND_URL = "https://bpm-social.preview.emergentagent.com/api"

# Test user credentials
TEST_USER_1 = {
    "email": "marco.rossi@example.com",
    "password": "SecurePass123!",
    "name": "Marco Rossi",
    "age": 28
}

TEST_USER_2 = {
    "email": "giulia.bianchi@example.com",
    "password": "SecurePass456!",
    "name": "Giulia Bianchi",
    "age": 26
}

class CrossUserNotificationTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.user1_token = None
        self.user1_id = None
        self.user2_token = None
        self.user2_id = None
        self.test_match_id = None
        self.session1 = requests.Session()
        self.session2 = requests.Session()
        
    def setup_user_authentication(self, user_data, session):
        """Authenticate user and get token"""
        print(f"🔐 Setting up authentication for {user_data['email']}...")
        
        # Try to login first
        login_data = {
            "email": user_data["email"],
            "password": user_data["password"]
        }
        
        response = session.post(f"{self.base_url}/auth/login", json=login_data)
        
        if response.status_code == 401:
            # User doesn't exist, create it
            print(f"📝 Creating new user {user_data['email']}...")
            create_response = session.post(f"{self.base_url}/auth/register", json=user_data)
            
            if create_response.status_code != 200:
                print(f"❌ Failed to create user: {create_response.status_code}")
                print(f"Response: {create_response.text}")
                return None, None
            
            response = create_response
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            user_id = data.get("user", {}).get("id")
            
            # Set Authorization header
            session.headers.update({"Authorization": f"Bearer {token}"})
            
            print(f"✅ Authentication successful. User ID: {user_id}")
            return token, user_id
        else:
            print(f"❌ Authentication failed: {response.status_code}")
            return None, None
    
    def setup_authentication(self):
        """Setup authentication for both users"""
        print("🔐 Setting up dual user authentication...")
        
        self.user1_token, self.user1_id = self.setup_user_authentication(TEST_USER_1, self.session1)
        if not self.user1_token:
            return False
        
        self.user2_token, self.user2_id = self.setup_user_authentication(TEST_USER_2, self.session2)
        if not self.user2_token:
            return False
            
        print(f"✅ Both users authenticated successfully")
        return True
    
    def create_cross_user_match(self):
        """Create a match between the two test users"""
        print("🎯 Creating cross-user match...")
        
        # Create match manually in database through a custom endpoint
        # Since we don't have a proper match creation endpoint, we'll create one programmatically
        
        # First, let's check if there's an existing match
        response = self.session1.get(f"{self.base_url}/chat/matches")
        if response.status_code == 200:
            matches = response.json()
            for match in matches:
                if (match["user1_id"] == self.user1_id and match["user2_id"] == self.user2_id) or \
                   (match["user1_id"] == self.user2_id and match["user2_id"] == self.user1_id):
                    self.test_match_id = match["id"]
                    print(f"✅ Using existing cross-user match: {self.test_match_id}")
                    return True
        
        # We need to create a custom match with both real users
        # Let's directly insert into database using the notification test method
        try:
            import sys
            sys.path.append('/app/backend')
            from motor.motor_asyncio import AsyncIOMotorClient
            import asyncio
            import uuid
            
            mongo_url = "mongodb://localhost:27017"
            client = AsyncIOMotorClient(mongo_url)
            db = client["test_database"]
            
            async def create_real_match():
                match_doc = {
                    "id": str(uuid.uuid4()),
                    "user1_id": self.user1_id,
                    "user2_id": self.user2_id,
                    "cardiac_score": 92,
                    "matched_at": datetime.utcnow()
                }
                
                await db.matches.insert_one(match_doc)
                return match_doc["id"]
            
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            self.test_match_id = loop.run_until_complete(create_real_match())
            loop.close()
            
            print(f"✅ Created cross-user match: {self.test_match_id}")
            return True
            
        except Exception as e:
            print(f"❌ Error creating cross-user match: {e}")
            return False
    
    def clear_user_notifications(self, session, user_name):
        """Clear notifications for a user"""
        print(f"🧹 Clearing notifications for {user_name}...")
        
        response = session.get(f"{self.base_url}/notifications")
        if response.status_code == 200:
            notifications = response.json()
            
            for notif in notifications:
                delete_response = session.delete(f"{self.base_url}/notifications/{notif['id']}")
                if delete_response.status_code == 200:
                    print(f"   Deleted notification: {notif['id']}")
            
            print(f"✅ Cleared {len(notifications)} notifications for {user_name}")
    
    def test_cross_user_notification(self):
        """Test notification creation when User 1 sends message to User 2"""
        print("\n🔔 Testing: Cross-user notification trigger")
        
        # Clear notifications for User 2
        self.clear_user_notifications(self.session2, "User 2")
        
        # User 1 sends message to User 2
        message_data = {
            "message": f"Hello {TEST_USER_2['name']}! This should create a notification for you.",
            "message_type": "text"
        }
        
        response = self.session1.post(
            f"{self.base_url}/chat/{self.test_match_id}/messages",
            json=message_data
        )
        
        if response.status_code != 200:
            print(f"❌ Failed to send message: {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        print("✅ Message sent from User 1 to User 2")
        
        # Check if User 2 received notification
        notif_response = self.session2.get(f"{self.base_url}/notifications")
        if notif_response.status_code == 200:
            notifications = notif_response.json()
            print(f"📧 User 2 has {len(notifications)} notifications")
            
            # Look for the new message notification
            new_message_notif = None
            for notif in notifications:
                if notif.get("notification_type") == "new_message":
                    new_message_notif = notif
                    break
            
            if new_message_notif:
                print("✅ Found new_message notification!")
                print(f"   Title: {new_message_notif['title']}")
                print(f"   Message: {new_message_notif['message']}")
                print(f"   From data: {new_message_notif.get('data', {})}")
                return True
            else:
                print("❌ No new_message notification found")
                for notif in notifications:
                    print(f"   Found: {notif.get('notification_type')} - {notif.get('title')}")
                return False
        else:
            print(f"❌ Failed to get User 2 notifications: {notif_response.status_code}")
            return False
    
    def test_reverse_cross_user_notification(self):
        """Test notification when User 2 sends message to User 1"""
        print("\n🔔 Testing: Reverse cross-user notification trigger")
        
        # Clear notifications for User 1
        self.clear_user_notifications(self.session1, "User 1")
        
        # User 2 sends message to User 1
        message_data = {
            "message": f"Hi {TEST_USER_1['name']}! This is a reply that should notify you.",
            "message_type": "text"
        }
        
        response = self.session2.post(
            f"{self.base_url}/chat/{self.test_match_id}/messages",
            json=message_data
        )
        
        if response.status_code != 200:
            print(f"❌ Failed to send message: {response.status_code}")
            return False
        
        print("✅ Message sent from User 2 to User 1")
        
        # Check if User 1 received notification
        notif_response = self.session1.get(f"{self.base_url}/notifications")
        if notif_response.status_code == 200:
            notifications = notif_response.json()
            print(f"📧 User 1 has {len(notifications)} notifications")
            
            # Look for the new message notification
            new_message_notif = None
            for notif in notifications:
                if notif.get("notification_type") == "new_message":
                    new_message_notif = notif
                    break
            
            if new_message_notif:
                print("✅ Found new_message notification!")
                print(f"   Title: {new_message_notif['title']}")
                print(f"   Message: {new_message_notif['message']}")
                return True
            else:
                print("❌ No new_message notification found")
                return False
        else:
            print(f"❌ Failed to get User 1 notifications: {notif_response.status_code}")
            return False
    
    def test_unread_count_after_notification(self):
        """Test unread count after notifications are created"""
        print("\n🔔 Testing: Unread count after notifications")
        
        # Check User 2's unread count (should have notification from User 1)
        response = self.session2.get(f"{self.base_url}/notifications/unread-count")
        if response.status_code == 200:
            data = response.json()
            count = data.get("count", 0)
            print(f"✅ User 2 unread count: {count}")
            if count > 0:
                return True
            else:
                print("⚠️ Expected unread count > 0 for User 2")
                return False
        else:
            print(f"❌ Failed to get unread count: {response.status_code}")
            return False
    
    def run_all_tests(self):
        """Run all cross-user notification tests"""
        print("🚀 Starting Cross-User Notification Tests")
        print(f"Backend URL: {self.base_url}")
        print("="*60)
        
        results = {}
        
        # Setup
        if not self.setup_authentication():
            print("❌ Authentication setup failed")
            return results
        
        if not self.create_cross_user_match():
            print("❌ Cross-user match creation failed")
            return results
        
        # Run tests
        results["cross_user_notification"] = self.test_cross_user_notification()
        results["reverse_cross_user_notification"] = self.test_reverse_cross_user_notification()
        results["unread_count_after_notification"] = self.test_unread_count_after_notification()
        
        # Summary
        print("\n" + "="*60)
        print("📊 CROSS-USER NOTIFICATION TEST SUMMARY")
        print("="*60)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name:35} {status}")
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        print(f"\nOverall: {passed}/{total} cross-user tests passed")
        
        if passed == total:
            print("🎉 ALL CROSS-USER NOTIFICATION TESTS PASSED!")
        else:
            print(f"⚠️  {total - passed} tests failed")
        
        return results

if __name__ == "__main__":
    tester = CrossUserNotificationTester()
    tester.run_all_tests()
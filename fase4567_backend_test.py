#!/usr/bin/env python3
"""
BPM Social FASE 4-7 Backend Testing
Tests all endpoints for FASE 4 (Geolocalizzazione), FASE 5 (Social & Gamification), 
FASE 6 (Premium & Security), FASE 7 (Settings Avanzati)

Tests 23 endpoints across 4 phases with comprehensive scenarios.
"""

import requests
import json
import sys
from datetime import datetime, timedelta
import random

# Backend URL
BASE_URL = "https://bpm-social.preview.emergentagent.com/api"

def print_status(message, status="INFO"):
    """Print colored status messages"""
    colors = {
        "SUCCESS": "\033[92m",  # Green
        "FAILURE": "\033[91m",  # Red
        "INFO": "\033[94m",     # Blue
        "WARNING": "\033[93m",  # Yellow
    }
    reset = "\033[0m"
    print(f"{colors.get(status, '')}{status}: {message}{reset}")

class BPMSocialTester:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.user_name = None
        self.test_event_id = None
        self.test_story_id = None
        self.test_referral_code = None
        
    def register_and_login_test_user(self):
        """Create and login test user for testing"""
        print_status("=== FASE 4-7 TESTING: Registering test user ===", "INFO")
        
        # Use realistic test data
        email = f"elena.rossi.{random.randint(1000, 9999)}@test.com"
        
        user_data = {
            "email": email,
            "password": "TestPassword123!",
            "name": "Elena Rossi",
            "age": 28,
            "bio": "Appassionata di eventi e tecnologia",
            "city": "Milano",
            "interests": ["tecnologia", "eventi", "viaggi", "musica"]
        }
        
        # Register user
        response = requests.post(f"{BASE_URL}/auth/register", json=user_data)
        
        if response.status_code == 200:
            data = response.json()
            self.token = data["access_token"]
            self.user_id = data["user"]["id"]
            self.user_name = data["user"]["name"]
            print_status(f"✅ User registered successfully: {self.user_name} (ID: {self.user_id})", "SUCCESS")
            return True
        else:
            print_status(f"❌ Registration failed: {response.status_code} - {response.text}", "FAILURE")
            return False

    def get_headers(self):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {self.token}"}

    def test_fase4_geolocation_events(self):
        """Test FASE 4 - Geolocalizzazione & Events (8 endpoints)"""
        print_status("\n=== TESTING FASE 4 - GEOLOCALIZZAZIONE & EVENTS ===", "INFO")
        results = {"passed": 0, "failed": 0}
        
        # Test 1: PUT /api/users/location - Update user location
        print_status("1. Testing PUT /api/users/location - Update user location", "INFO")
        location_data = {
            "latitude": 45.4654,  # Milano coordinates
            "longitude": 9.1859,
            "city": "Milano",
            "country": "Italy"
        }
        
        response = requests.put(f"{BASE_URL}/users/location", json=location_data, headers=self.get_headers())
        if response.status_code == 200 and response.json().get("success"):
            print_status("✅ Location update successful", "SUCCESS")
            results["passed"] += 1
        else:
            print_status(f"❌ Location update failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        # Test 2: POST /api/events - Create event
        print_status("2. Testing POST /api/events - Create event", "INFO")
        event_data = {
            "title": "Aperitivo Networking Tech Milano",
            "description": "Un aperitivo per incontrare persone appassionate di tecnologia nel cuore di Milano",
            "latitude": 45.4642,  # Duomo area
            "longitude": 9.1900,
            "address": "Via del Corso 15, Milano",
            "city": "Milano",
            "start_time": (datetime.utcnow() + timedelta(days=7)).isoformat(),
            "end_time": (datetime.utcnow() + timedelta(days=7, hours=3)).isoformat(),
            "max_attendees": 20,
            "image_url": "https://example.com/event-image.jpg"
        }
        
        response = requests.post(f"{BASE_URL}/events", json=event_data, headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            self.test_event_id = data["id"]
            print_status(f"✅ Event created successfully: {data['title']} (ID: {self.test_event_id})", "SUCCESS")
            results["passed"] += 1
        else:
            print_status(f"❌ Event creation failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        # Test 3: GET /api/events - List events with distance filter
        print_status("3. Testing GET /api/events - List events", "INFO")
        response = requests.get(f"{BASE_URL}/events", headers=self.get_headers())
        if response.status_code == 200:
            events = response.json()
            if isinstance(events, list):
                print_status(f"✅ Events list retrieved: {len(events)} events found", "SUCCESS")
                results["passed"] += 1
            else:
                print_status(f"❌ Events list invalid format", "FAILURE")
                results["failed"] += 1
        else:
            print_status(f"❌ Events list failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        # Test 4: GET /api/events/nearby - Nearby events
        print_status("4. Testing GET /api/events/nearby - Nearby events", "INFO")
        response = requests.get(f"{BASE_URL}/events/nearby?max_distance_km=5", headers=self.get_headers())
        if response.status_code == 200:
            events = response.json()
            if isinstance(events, list):
                print_status(f"✅ Nearby events retrieved: {len(events)} events within 5km", "SUCCESS")
                results["passed"] += 1
            else:
                print_status(f"❌ Nearby events invalid format", "FAILURE")
                results["failed"] += 1
        else:
            print_status(f"❌ Nearby events failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        # Test 5: GET /api/events/{id} - Event details with distance
        if self.test_event_id:
            print_status("5. Testing GET /api/events/{id} - Event details", "INFO")
            response = requests.get(f"{BASE_URL}/events/{self.test_event_id}", headers=self.get_headers())
            if response.status_code == 200:
                event = response.json()
                if event.get("id") == self.test_event_id:
                    print_status(f"✅ Event details retrieved: {event['title']}", "SUCCESS")
                    results["passed"] += 1
                else:
                    print_status(f"❌ Event details mismatch", "FAILURE")
                    results["failed"] += 1
            else:
                print_status(f"❌ Event details failed: {response.status_code} - {response.text}", "FAILURE")
                results["failed"] += 1

        # Test 6: POST /api/events/{id}/attend - Attend event
        if self.test_event_id:
            print_status("6. Testing POST /api/events/{id}/attend - Attend event", "INFO")
            response = requests.post(f"{BASE_URL}/events/{self.test_event_id}/attend", headers=self.get_headers())
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    print_status(f"✅ Event attendance successful: {data.get('message')}", "SUCCESS")
                    results["passed"] += 1
                else:
                    print_status(f"❌ Event attendance failed: no success flag", "FAILURE")
                    results["failed"] += 1
            else:
                print_status(f"❌ Event attendance failed: {response.status_code} - {response.text}", "FAILURE")
                results["failed"] += 1

        # Test 7: GET /api/events/{id}/attendees - List attendees
        if self.test_event_id:
            print_status("7. Testing GET /api/events/{id}/attendees - List attendees", "INFO")
            response = requests.get(f"{BASE_URL}/events/{self.test_event_id}/attendees", headers=self.get_headers())
            if response.status_code == 200:
                data = response.json()
                if "attendees" in data and "count" in data:
                    print_status(f"✅ Attendees list retrieved: {data['count']} attendees", "SUCCESS")
                    results["passed"] += 1
                else:
                    print_status(f"❌ Attendees list invalid format", "FAILURE")
                    results["failed"] += 1
            else:
                print_status(f"❌ Attendees list failed: {response.status_code} - {response.text}", "FAILURE")
                results["failed"] += 1

        # Test 8: DELETE /api/events/{id}/attend - Leave event
        if self.test_event_id:
            print_status("8. Testing DELETE /api/events/{id}/attend - Leave event", "INFO")
            response = requests.delete(f"{BASE_URL}/events/{self.test_event_id}/attend", headers=self.get_headers())
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    print_status(f"✅ Event leave successful: {data.get('message')}", "SUCCESS")
                    results["passed"] += 1
                else:
                    print_status(f"❌ Event leave failed: no success flag", "FAILURE")
                    results["failed"] += 1
            else:
                print_status(f"❌ Event leave failed: {response.status_code} - {response.text}", "FAILURE")
                results["failed"] += 1

        print_status(f"FASE 4 Results: {results['passed']}/8 tests passed, {results['failed']} failed", 
                    "SUCCESS" if results["failed"] == 0 else "WARNING")
        return results

    def test_fase5_social_gamification(self):
        """Test FASE 5 - Social & Gamification (8 endpoints)"""
        print_status("\n=== TESTING FASE 5 - SOCIAL & GAMIFICATION ===", "INFO")
        results = {"passed": 0, "failed": 0}
        
        # Test 9: POST /api/stories - Create story (24h expiry)
        print_status("9. Testing POST /api/stories - Create story", "INFO")
        story_data = {
            "media_url": "https://example.com/story-photo.jpg",
            "media_type": "image",
            "caption": "Esplorando Milano! 📸 #milanlife"
        }
        
        response = requests.post(f"{BASE_URL}/stories", json=story_data, headers=self.get_headers())
        if response.status_code == 200:
            story = response.json()
            self.test_story_id = story["id"]
            expires_at = datetime.fromisoformat(story["expires_at"].replace('Z', '+00:00'))
            created_at = datetime.fromisoformat(story["created_at"].replace('Z', '+00:00'))
            duration = expires_at - created_at
            if abs(duration.total_seconds() - 24*3600) < 60:  # Within 1 minute of 24h
                print_status(f"✅ Story created successfully: expires in ~24h (ID: {self.test_story_id})", "SUCCESS")
                results["passed"] += 1
            else:
                print_status(f"❌ Story expiry time incorrect: {duration}", "FAILURE")
                results["failed"] += 1
        else:
            print_status(f"❌ Story creation failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        # Test 10: GET /api/stories - Get all active stories
        print_status("10. Testing GET /api/stories - Get active stories", "INFO")
        response = requests.get(f"{BASE_URL}/stories", headers=self.get_headers())
        if response.status_code == 200:
            stories = response.json()
            if isinstance(stories, list):
                print_status(f"✅ Active stories retrieved: {len(stories)} users with stories", "SUCCESS")
                results["passed"] += 1
            else:
                print_status(f"❌ Active stories invalid format", "FAILURE")
                results["failed"] += 1
        else:
            print_status(f"❌ Active stories failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        # Test 11: GET /api/stories/{user_id} - Get user stories
        print_status("11. Testing GET /api/stories/{user_id} - Get user stories", "INFO")
        response = requests.get(f"{BASE_URL}/stories/{self.user_id}", headers=self.get_headers())
        if response.status_code == 200:
            stories = response.json()
            if isinstance(stories, list):
                print_status(f"✅ User stories retrieved: {len(stories)} stories", "SUCCESS")
                results["passed"] += 1
            else:
                print_status(f"❌ User stories invalid format", "FAILURE")
                results["failed"] += 1
        else:
            print_status(f"❌ User stories failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        # Test 12: DELETE /api/stories/{id} - Delete story
        if self.test_story_id:
            print_status("12. Testing DELETE /api/stories/{id} - Delete story", "INFO")
            response = requests.delete(f"{BASE_URL}/stories/{self.test_story_id}", headers=self.get_headers())
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    print_status(f"✅ Story deleted successfully", "SUCCESS")
                    results["passed"] += 1
                else:
                    print_status(f"❌ Story deletion failed: no success flag", "FAILURE")
                    results["failed"] += 1
            else:
                print_status(f"❌ Story deletion failed: {response.status_code} - {response.text}", "FAILURE")
                results["failed"] += 1

        # Test 13: GET /api/badges - Get user badges (auto-award on milestones)
        print_status("13. Testing GET /api/badges - Get user badges", "INFO")
        response = requests.get(f"{BASE_URL}/badges", headers=self.get_headers())
        if response.status_code == 200:
            badges = response.json()
            if isinstance(badges, list):
                print_status(f"✅ Badges retrieved: {len(badges)} badges earned", "SUCCESS")
                results["passed"] += 1
            else:
                print_status(f"❌ Badges invalid format", "FAILURE")
                results["failed"] += 1
        else:
            print_status(f"❌ Badges failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        # Test 14: POST /api/referrals/generate - Generate referral code
        print_status("14. Testing POST /api/referrals/generate - Generate referral code", "INFO")
        response = requests.post(f"{BASE_URL}/referrals/generate", headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            if "code" in data and "share_url" in data:
                self.test_referral_code = data["code"]
                print_status(f"✅ Referral code generated: {self.test_referral_code}", "SUCCESS")
                results["passed"] += 1
            else:
                print_status(f"❌ Referral code missing fields", "FAILURE")
                results["failed"] += 1
        else:
            print_status(f"❌ Referral code generation failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        # Test 15: GET /api/referrals/stats - Referral statistics
        print_status("15. Testing GET /api/referrals/stats - Referral stats", "INFO")
        response = requests.get(f"{BASE_URL}/referrals/stats", headers=self.get_headers())
        if response.status_code == 200:
            stats = response.json()
            if "code" in stats and "referred_count" in stats:
                print_status(f"✅ Referral stats retrieved: {stats['referred_count']} referrals", "SUCCESS")
                results["passed"] += 1
            else:
                print_status(f"❌ Referral stats missing fields", "FAILURE")
                results["failed"] += 1
        else:
            print_status(f"❌ Referral stats failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        # Test 16: POST /api/referrals/redeem - Redeem referral code (create test user)
        print_status("16. Testing POST /api/referrals/redeem - Redeem referral code", "INFO")
        # Create second user to test referral redemption
        second_user_email = f"marco.bianchi.{random.randint(1000, 9999)}@test.com"
        second_user_data = {
            "email": second_user_email,
            "password": "TestPassword123!",
            "name": "Marco Bianchi",
            "age": 32,
            "city": "Roma"
        }
        
        register_response = requests.post(f"{BASE_URL}/auth/register", json=second_user_data)
        if register_response.status_code == 200 and self.test_referral_code:
            second_user_token = register_response.json()["access_token"]
            
            # Try to redeem referral code
            redemption_data = {"code": self.test_referral_code}
            response = requests.post(f"{BASE_URL}/referrals/redeem", 
                                   json=redemption_data, 
                                   headers={"Authorization": f"Bearer {second_user_token}"})
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    print_status(f"✅ Referral code redeemed successfully", "SUCCESS")
                    results["passed"] += 1
                else:
                    print_status(f"❌ Referral redemption failed: no success flag", "FAILURE")
                    results["failed"] += 1
            else:
                print_status(f"❌ Referral redemption failed: {response.status_code} - {response.text}", "FAILURE")
                results["failed"] += 1
        else:
            print_status(f"❌ Could not create second user for referral test", "FAILURE")
            results["failed"] += 1

        print_status(f"FASE 5 Results: {results['passed']}/8 tests passed, {results['failed']} failed", 
                    "SUCCESS" if results["failed"] == 0 else "WARNING")
        return results

    def test_fase6_premium_security(self):
        """Test FASE 6 - Premium & Security (4 endpoints)"""
        print_status("\n=== TESTING FASE 6 - PREMIUM & SECURITY ===", "INFO")
        results = {"passed": 0, "failed": 0}
        
        # Test 17: POST /api/users/verify - Request identity verification
        print_status("17. Testing POST /api/users/verify - Request verification", "INFO")
        verification_data = {
            "selfie_url": "https://example.com/selfie.jpg",
            "document_url": "https://example.com/document.jpg"
        }
        
        response = requests.post(f"{BASE_URL}/users/verify", json=verification_data, headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_status(f"✅ Verification request submitted: {data.get('message')}", "SUCCESS")
                results["passed"] += 1
            else:
                print_status(f"❌ Verification request failed: no success flag", "FAILURE")
                results["failed"] += 1
        else:
            print_status(f"❌ Verification request failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        # Test 18: PUT /api/users/incognito - Toggle incognito mode
        print_status("18. Testing PUT /api/users/incognito - Toggle incognito mode", "INFO")
        incognito_data = {"enabled": True}
        
        response = requests.put(f"{BASE_URL}/users/incognito", json=incognito_data, headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and data.get("incognito_enabled") == True:
                print_status(f"✅ Incognito mode enabled successfully", "SUCCESS")
                results["passed"] += 1
            else:
                print_status(f"❌ Incognito mode toggle failed", "FAILURE")
                results["failed"] += 1
        else:
            print_status(f"❌ Incognito mode failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        # Test 19: POST /api/premium/subscribe - Subscribe to premium (mock)
        print_status("19. Testing POST /api/premium/subscribe - Subscribe to premium", "INFO")
        subscription_data = {"plan_type": "monthly"}
        
        response = requests.post(f"{BASE_URL}/premium/subscribe", json=subscription_data, headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_status(f"✅ Premium subscription successful: {data.get('message')}", "SUCCESS")
                results["passed"] += 1
            else:
                print_status(f"❌ Premium subscription failed: no success flag", "FAILURE")
                results["failed"] += 1
        else:
            print_status(f"❌ Premium subscription failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        # Test 20: GET /api/premium/status - Get premium status
        print_status("20. Testing GET /api/premium/status - Get premium status", "INFO")
        response = requests.get(f"{BASE_URL}/premium/status", headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            if "premium" in data:
                print_status(f"✅ Premium status retrieved: premium={data['premium']}", "SUCCESS")
                results["passed"] += 1
            else:
                print_status(f"❌ Premium status missing fields", "FAILURE")
                results["failed"] += 1
        else:
            print_status(f"❌ Premium status failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        print_status(f"FASE 6 Results: {results['passed']}/4 tests passed, {results['failed']} failed", 
                    "SUCCESS" if results["failed"] == 0 else "WARNING")
        return results

    def test_fase7_settings_advanced(self):
        """Test FASE 7 - Settings Avanzati (3 endpoints)"""
        print_status("\n=== TESTING FASE 7 - SETTINGS AVANZATI ===", "INFO")
        results = {"passed": 0, "failed": 0}
        
        # Test 21: PUT /api/users/preferences - Update user preferences
        print_status("21. Testing PUT /api/users/preferences - Update preferences", "INFO")
        preferences_data = {
            "age_min": 25,
            "age_max": 35,
            "distance_max": 25,
            "height_min": 160,
            "height_max": 185,
            "lifestyle": "active",
            "smoker_preference": "non-smoker",
            "show_me": "everyone",
            "dark_mode": True
        }
        
        response = requests.put(f"{BASE_URL}/users/preferences", json=preferences_data, headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_status(f"✅ Preferences updated successfully", "SUCCESS")
                results["passed"] += 1
            else:
                print_status(f"❌ Preferences update failed: no success flag", "FAILURE")
                results["failed"] += 1
        else:
            print_status(f"❌ Preferences update failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        # Test 22: GET /api/users/preferences - Get user preferences
        print_status("22. Testing GET /api/users/preferences - Get preferences", "INFO")
        response = requests.get(f"{BASE_URL}/users/preferences", headers=self.get_headers())
        if response.status_code == 200:
            prefs = response.json()
            if isinstance(prefs, dict) and "age_min" in prefs:
                print_status(f"✅ Preferences retrieved: age_min={prefs.get('age_min')}", "SUCCESS")
                results["passed"] += 1
            else:
                print_status(f"❌ Preferences invalid format", "FAILURE")
                results["failed"] += 1
        else:
            print_status(f"❌ Preferences retrieval failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        # Test 23: PUT /api/users/pause-account - Pause account temporarily
        print_status("23. Testing PUT /api/users/pause-account - Pause account", "INFO")
        pause_data = {"paused": True}
        
        response = requests.put(f"{BASE_URL}/users/pause-account", json=pause_data, headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and data.get("paused") == True:
                print_status(f"✅ Account paused successfully", "SUCCESS")
                results["passed"] += 1
                
                # Test unpausing
                unpause_data = {"paused": False}
                unpause_response = requests.put(f"{BASE_URL}/users/pause-account", json=unpause_data, headers=self.get_headers())
                if unpause_response.status_code == 200 and unpause_response.json().get("paused") == False:
                    print_status(f"✅ Account unpaused successfully", "SUCCESS")
                else:
                    print_status(f"❌ Account unpause failed", "FAILURE")
            else:
                print_status(f"❌ Account pause failed", "FAILURE")
                results["failed"] += 1
        else:
            print_status(f"❌ Account pause failed: {response.status_code} - {response.text}", "FAILURE")
            results["failed"] += 1

        print_status(f"FASE 7 Results: {results['passed']}/3 tests passed, {results['failed']} failed", 
                    "SUCCESS" if results["failed"] == 0 else "WARNING")
        return results

    def test_authentication_required(self):
        """Test that all endpoints require authentication"""
        print_status("\n=== TESTING AUTHENTICATION REQUIREMENTS ===", "INFO")
        
        test_endpoints = [
            ("PUT", "/users/location"),
            ("POST", "/events"), 
            ("GET", "/events"),
            ("POST", "/stories"),
            ("GET", "/badges"),
            ("POST", "/users/verify"),
            ("GET", "/premium/status"),
            ("PUT", "/users/preferences")
        ]
        
        auth_failures = 0
        for method, endpoint in test_endpoints:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{endpoint}")
            elif method == "POST":
                response = requests.post(f"{BASE_URL}{endpoint}", json={})
            elif method == "PUT":
                response = requests.put(f"{BASE_URL}{endpoint}", json={})
                
            if response.status_code in [401, 403]:
                auth_failures += 1
            
        if auth_failures == len(test_endpoints):
            print_status(f"✅ All {len(test_endpoints)} endpoints properly require authentication", "SUCCESS")
            return True
        else:
            print_status(f"❌ {len(test_endpoints) - auth_failures} endpoints missing auth protection", "FAILURE")
            return False

    def run_all_tests(self):
        """Run comprehensive tests for all FASE 4-7 endpoints"""
        print_status("🚀 Starting BPM Social FASE 4-7 Backend Testing", "INFO")
        print_status(f"Backend URL: {BASE_URL}", "INFO")
        
        # Register test user
        if not self.register_and_login_test_user():
            print_status("❌ Failed to register test user. Cannot continue.", "FAILURE")
            return False

        # Run all test phases
        fase4_results = self.test_fase4_geolocation_events()
        fase5_results = self.test_fase5_social_gamification()
        fase6_results = self.test_fase6_premium_security()
        fase7_results = self.test_fase7_settings_advanced()
        
        # Test authentication requirements
        auth_ok = self.test_authentication_required()
        
        # Calculate overall results
        total_passed = (fase4_results["passed"] + fase5_results["passed"] + 
                       fase6_results["passed"] + fase7_results["passed"])
        total_failed = (fase4_results["failed"] + fase5_results["failed"] + 
                       fase6_results["failed"] + fase7_results["failed"])
        total_tests = total_passed + total_failed
        
        # Final summary
        print_status(f"\n{'='*60}", "INFO")
        print_status(f"🎯 BPM SOCIAL FASE 4-7 TESTING COMPLETE", "INFO")
        print_status(f"{'='*60}", "INFO")
        
        print_status(f"📊 DETAILED RESULTS:", "INFO")
        print_status(f"   FASE 4 (Geolocalizzazione): {fase4_results['passed']}/8 passed", 
                    "SUCCESS" if fase4_results["failed"] == 0 else "WARNING")
        print_status(f"   FASE 5 (Social & Gamification): {fase5_results['passed']}/8 passed", 
                    "SUCCESS" if fase5_results["failed"] == 0 else "WARNING")
        print_status(f"   FASE 6 (Premium & Security): {fase6_results['passed']}/4 passed", 
                    "SUCCESS" if fase6_results["failed"] == 0 else "WARNING")
        print_status(f"   FASE 7 (Settings Avanzati): {fase7_results['passed']}/3 passed", 
                    "SUCCESS" if fase7_results["failed"] == 0 else "WARNING")
        print_status(f"   Authentication Security: {'✅ SECURED' if auth_ok else '❌ VULNERABLE'}", 
                    "SUCCESS" if auth_ok else "FAILURE")
        
        print_status(f"\n🏆 OVERALL SCORE: {total_passed}/{total_tests} tests passed ({total_passed/total_tests*100:.1f}%)", 
                    "SUCCESS" if total_failed == 0 else ("WARNING" if total_failed < 5 else "FAILURE"))
        
        if total_failed == 0:
            print_status(f"🎉 ALL FASE 4-7 BACKEND FEATURES ARE WORKING PERFECTLY!", "SUCCESS")
        else:
            print_status(f"⚠️  {total_failed} issues found that need attention", "WARNING")
            
        return total_failed == 0

if __name__ == "__main__":
    tester = BPMSocialTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
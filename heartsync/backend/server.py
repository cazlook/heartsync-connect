from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Query, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from models import (
    UserCreate, UserLogin, TokenResponse, UserResponse, UserUpdate,
    SwipeCreate, RefreshRequest,
    Match, ChatMessage, ChatMessageCreate, Notification, FCMToken,
    HeartRateReading, HeartRateReadingCreate, EmotionalReactionDB, EmotionalReactionCreate,
    BiometricStats, TopReaction,
    Event, EventCreate, EventResponse, EventInvite, EventInviteCreate, EventInviteStatusUpdate,
    Location, UserLocationUpdate,
    Story, StoryCreate, Badge, ReferralCode, ReferralRedemption,
    NotificationType
)
from auth import register_user, login_user, firebase_auth, blacklist_token, is_token_blacklisted
from dependencies import get_current_user_dependency, get_db
from notifications import (
    get_unread_count, mark_as_read, mark_all_as_read,
    notify_new_match, notify_new_message
)
from biometrics import (
    calculate_stats, get_top_reactions, get_bpm_timeline,
    get_reactions_history, get_weekly_summary
)
from geolocation import calculate_distance, filter_by_distance
from gamification import (
    check_and_award_badges, create_referral_code, redeem_referral_code
)
import socketio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Create the main FastAPI app
fastapi_app = FastAPI()
fastapi_app.state.limiter = limiter
fastapi_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — must be registered before routes
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')
allowed_origins = CORS_ORIGINS.split(',') if CORS_ORIGINS != '*' else ['*']
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


def _calculate_cardiac_score(user1: dict, user2: dict) -> int:
    """Calculate match score based on interests, age, and city."""
    score = 50

    i1 = set(user1.get("interests", []))
    i2 = set(user2.get("interests", []))
    if i1 or i2:
        jaccard = len(i1 & i2) / len(i1 | i2)
        score += int(jaccard * 30)

    age1 = user1.get("age") or 25
    age2 = user2.get("age") or 25
    age_diff = abs(age1 - age2)
    if age_diff <= 3:
        score += 15
    elif age_diff <= 7:
        score += 10
    elif age_diff <= 12:
        score += 5

    if user1.get("city") and user1.get("city") == user2.get("city"):
        score += 5

    return min(score, 99)


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# ===== AUTHENTICATION ROUTES =====

@api_router.post("/auth/register", response_model=TokenResponse)
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserCreate, database = Depends(get_db)):
    return await register_user(user_data, database)

@api_router.post("/auth/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, login_data: UserLogin, database = Depends(get_db)):
    return await login_user(login_data, database)

@api_router.post("/auth/refresh")
@limiter.limit("20/minute")
async def refresh_token(request: Request, body: RefreshRequest, database = Depends(get_db)):
    """Issue a new access token using a valid refresh token."""
    try:
        payload = firebase_auth.verify_token(body.refresh_token)
    except HTTPException:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not a refresh token")

    jti = payload.get("jti")
    if jti and await is_token_blacklisted(jti, database):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")

    stored = await database.refresh_tokens.find_one({"jti": jti})
    if not stored:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token not found")

    uid = payload.get("sub")
    email = payload.get("email")
    new_access, _ = firebase_auth.create_access_token(uid, email)
    return {"access_token": new_access, "token_type": "bearer"}

@api_router.post("/auth/logout")
async def logout(
    request: Request,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Blacklist the current access token so it can no longer be used."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "").replace("bearer ", "")
    if token:
        try:
            payload = firebase_auth.verify_token(token)
            jti = payload.get("jti")
            if jti:
                await blacklist_token(jti, current_user.id, database)
        except Exception:
            pass
    logger.info("User %s logged out", current_user.id)
    return {"success": True}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_user_dependency)):
    """Get current user profile"""
    return current_user

@api_router.put("/auth/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UserUpdate,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Update user profile"""
    # Update only provided fields
    update_dict = {k: v for k, v in profile_data.dict().items() if v is not None}
    
    if update_dict:
        await database.users.update_one(
            {"id": current_user.id},
            {"$set": update_dict}
        )
    
    # Return updated user
    updated_user = await database.users.find_one({"id": current_user.id})
    return UserResponse(**updated_user)

# ===== DISCOVERY ROUTES =====

@api_router.get("/discovery/profiles")
async def get_discovery_profiles(
    limit: int = Query(default=20, le=50),
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    already_swiped = await database.swipes.find(
        {"swiper_id": current_user.id}, {"swiped_id": 1}
    ).to_list(10000)
    exclude_ids = {s["swiped_id"] for s in already_swiped}
    exclude_ids.add(current_user.id)

    query = {"id": {"$nin": list(exclude_ids)}}

    gender_map = {"Uomini": "Uomo", "Donne": "Donna", "Men": "Uomo", "Women": "Donna"}
    seeking = getattr(current_user, "seeking", None)
    if seeking and seeking not in ("Tutti", "Both", "Entrambi"):
        target = gender_map.get(seeking, seeking)
        if target:
            query["gender"] = target

    profiles = await database.users.find(query).limit(limit).to_list(limit)
    result = []
    for p in profiles:
        result.append({
            "id": p["id"],
            "name": p["name"],
            "age": p.get("age"),
            "bio": p.get("bio"),
            "city": p.get("city"),
            "interests": p.get("interests", []),
            "photos": p.get("photos", []),
            "verified": p.get("verified", False),
            "premium": p.get("premium", False),
        })
    return result

@api_router.delete("/discovery/swipes/reset")
async def reset_my_swipes(
    current_user: UserResponse = Depends(get_current_user_dependency),
    database=Depends(get_db)
):
    result = await database.swipes.delete_many({"swiper_id": current_user.id})
    return {"deleted": result.deleted_count, "message": "Swipe resettati, puoi rivedere tutti i profili"}

@api_router.post("/discovery/swipe")
async def swipe_profile(
    swipe: SwipeCreate,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    existing = await database.swipes.find_one({
        "swiper_id": current_user.id,
        "swiped_id": swipe.profile_id
    })
    if existing:
        return {"match": False, "duplicate": True}

    await database.swipes.insert_one({
        "id": str(uuid.uuid4()),
        "swiper_id": current_user.id,
        "swiped_id": swipe.profile_id,
        "direction": swipe.direction,
        "timestamp": datetime.utcnow()
    })

    if swipe.direction not in ("like", "super_like"):
        return {"match": False}

    mutual = await database.swipes.find_one({
        "swiper_id": swipe.profile_id,
        "swiped_id": current_user.id,
        "direction": {"$in": ["like", "super_like"]}
    })

    if not mutual:
        return {"match": False}

    existing_match = await database.matches.find_one({"$or": [
        {"user1_id": current_user.id, "user2_id": swipe.profile_id},
        {"user1_id": swipe.profile_id, "user2_id": current_user.id}
    ]})
    if existing_match:
        return {"match": True, "match_id": existing_match["id"]}

    current_user_doc = await database.users.find_one({"id": current_user.id})
    other_doc = await database.users.find_one({"id": swipe.profile_id})

    cardiac_score = _calculate_cardiac_score(current_user_doc or {}, other_doc or {})
    match_doc = {
        "id": str(uuid.uuid4()),
        "user1_id": current_user.id,
        "user2_id": swipe.profile_id,
        "cardiac_score": cardiac_score,
        "matched_at": datetime.utcnow()
    }
    await database.matches.insert_one(match_doc)

    other = await database.users.find_one({"id": swipe.profile_id})
    other_name = other["name"] if other else "qualcuno"

    try:
        await create_notification(database, {
            "user_id": swipe.profile_id,
            "notification_type": "new_match",
            "title": "Nuovo Match! 💕",
            "message": f"Hai un nuovo match con {current_user.name}!",
            "data": {"match_id": match_doc["id"]}
        })
        await create_notification(database, {
            "user_id": current_user.id,
            "notification_type": "new_match",
            "title": "Nuovo Match! 💕",
            "message": f"Hai un nuovo match con {other_name}!",
            "data": {"match_id": match_doc["id"]}
        })
    except Exception:
        pass

    return {"match": True, "match_id": match_doc["id"], "other_name": other_name}

# ===== CHAT & MATCHES ROUTES =====
@api_router.post("/chat/create-test-match")
async def create_test_match(
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Create a test match for development"""
    # Create a test match with current user
    match_doc = {
        "id": str(uuid.uuid4()),
        "user1_id": current_user.id,
        "user2_id": "test-user-2",
        "cardiac_score": 85,
        "matched_at": datetime.utcnow()
    }
    
    await database.matches.insert_one(match_doc)
    return Match(**match_doc)

@api_router.get("/chat/matches")
async def get_user_matches(
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    matches = await database.matches.find({
        "$or": [
            {"user1_id": current_user.id},
            {"user2_id": current_user.id}
        ]
    }).to_list(1000)

    result = []
    for m in matches:
        other_id = m["user2_id"] if m["user1_id"] == current_user.id else m["user1_id"]
        other = await database.users.find_one({"id": other_id})
        last_msg = await database.messages.find_one(
            {"match_id": m["id"]}, sort=[("timestamp", -1)]
        )
        result.append({
            "id": m["id"],
            "user1_id": m["user1_id"],
            "user2_id": m["user2_id"],
            "cardiac_score": m.get("cardiac_score", 80),
            "matched_at": m.get("matched_at"),
            "other_user": {
                "id": other_id,
                "name": other["name"] if other else "Utente",
                "age": other.get("age") if other else None,
                "photos": other.get("photos", []) if other else [],
                "verified": other.get("verified", False) if other else False,
                "city": other.get("city") if other else None,
            },
            "last_message": last_msg["message"] if last_msg else None,
        })
    return result

@api_router.get("/chat/{match_id}/messages")
async def get_match_messages(
    match_id: str,
    limit: int = Query(default=50, le=200),
    before: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get messages for a specific match"""
    # Verify user is part of the match
    match = await database.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if current_user.id not in [match["user1_id"], match["user2_id"]]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Build query
    query = {"match_id": match_id}
    if before:
        query["timestamp"] = {"$lt": datetime.fromisoformat(before)}
    
    # Get messages
    messages = await database.messages.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    
    # Convert to response format
    result = []
    for msg in messages:
        result.append({
            "id": msg["id"],
            "match_id": msg["match_id"],
            "sender_id": msg["sender_id"],
            "message": msg["message"],
            "message_type": msg.get("message_type", "text"),
            "timestamp": msg["timestamp"].isoformat(),
            "read": msg.get("read", False),
            "reactions": msg.get("reactions", [])
        })
    
    return result

@api_router.post("/chat/{match_id}/messages")
async def send_message_rest(
    match_id: str,
    message: ChatMessageCreate,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Send message via REST (backup for WebSocket)"""
    # Verify user is part of the match
    match = await database.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if current_user.id not in [match["user1_id"], match["user2_id"]]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Create message
    message_doc = {
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "sender_id": current_user.id,
        "message": message.message,
        "message_type": message.message_type,
        "timestamp": datetime.utcnow(),
        "read": False,
        "reactions": []
    }
    
    await database.messages.insert_one(message_doc)
    
    # Send notification to other user
    other_user_id = match["user2_id"] if match["user1_id"] == current_user.id else match["user1_id"]
    try:
        await notify_new_message(database, other_user_id, current_user.name, match_id)
    except Exception as e:
        print(f"Error sending notification: {e}")
    
    return {
        "id": message_doc["id"],
        "match_id": match_id,
        "sender_id": current_user.id,
        "message": message.message,
        "message_type": message.message_type,
        "timestamp": message_doc["timestamp"].isoformat(),
        "read": False
    }

# ===== NOTIFICATIONS ROUTES =====
@api_router.get("/notifications")
async def get_notifications(
    limit: int = Query(default=50, le=200),
    skip: int = Query(default=0),
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get user notifications with pagination"""
    notifications = await database.notifications.find({
        "user_id": current_user.id
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return [Notification(**notif) for notif in notifications]

@api_router.get("/notifications/unread-count")
async def get_notifications_unread_count(
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get count of unread notifications"""
    count = await get_unread_count(database, current_user.id)
    return {"count": count}

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Mark a notification as read"""
    success = await mark_as_read(database, notification_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Mark all notifications as read"""
    count = await mark_all_as_read(database, current_user.id)
    return {"marked_read": count}

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Delete a notification"""
    result = await database.notifications.delete_one({
        "id": notification_id,
        "user_id": current_user.id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True}

@api_router.post("/notifications/register-token")
async def register_fcm_token(
    token_data: FCMToken,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Register FCM token for push notifications"""
    # Update or insert token
    await database.fcm_tokens.update_one(
        {"user_id": current_user.id},
        {"$set": {
            "user_id": current_user.id,
            "token": token_data.token,
            "device_type": token_data.device_type,
            "created_at": datetime.utcnow()
        }},
        upsert=True
    )
    
    return {"success": True}

# ===== BIOMETRICS & BPM ROUTES =====
@api_router.post("/biometrics/heartrate")
async def save_heartrate_reading(
    reading: HeartRateReadingCreate,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Save heart rate reading"""
    reading_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "bpm": reading.bpm,
        "context": reading.context,
        "timestamp": datetime.utcnow()
    }
    
    await database.heart_rate_readings.insert_one(reading_doc)
    return HeartRateReading(**reading_doc)

@api_router.post("/biometrics/reaction")
async def save_emotional_reaction(
    reaction: EmotionalReactionCreate,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Save emotional reaction to a profile"""
    reaction_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "profile_id": reaction.profile_id,
        "profile_name": reaction.profile_name,
        "bpm_before": reaction.bpm_before,
        "bpm_peak": reaction.bpm_peak,
        "bpm_delta": reaction.bpm_delta,
        "intensity": reaction.intensity,
        "timestamp": datetime.utcnow()
    }
    
    await database.emotional_reactions.insert_one(reaction_doc)
    return EmotionalReactionDB(**reaction_doc)

@api_router.get("/biometrics/stats")
async def get_biometric_stats(
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get biometric statistics for current user"""
    stats = await calculate_stats(database, current_user.id)
    return stats

@api_router.get("/biometrics/top-reactions")
async def get_top_emotional_reactions(
    limit: int = Query(default=10, le=50),
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get top profiles that caused strongest reactions"""
    reactions = await get_top_reactions(database, current_user.id, limit)
    return reactions

@api_router.get("/biometrics/timeline")
async def get_heartrate_timeline(
    days: int = Query(default=7, le=30),
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get BPM timeline for the last N days"""
    timeline = await get_bpm_timeline(database, current_user.id, days)
    return {"timeline": timeline}

@api_router.get("/biometrics/history")
async def get_reaction_history(
    days: int = Query(default=30, le=90),
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get reaction history for the last N days"""
    history = await get_reactions_history(database, current_user.id, days)
    return {"reactions": history}

@api_router.get("/biometrics/weekly-summary")
async def get_biometric_weekly_summary(
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get weekly summary of biometric data"""
    summary = await get_weekly_summary(database, current_user.id)
    return summary

# ===== LOCATION & EVENTS ROUTES =====
@api_router.put("/users/location")
async def update_user_location(
    location: UserLocationUpdate,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Update user location"""
    await database.users.update_one(
        {"id": current_user.id},
        {"$set": {
            "location": {
                "latitude": location.latitude,
                "longitude": location.longitude,
                "city": location.city,
                "country": location.country
            },
            "last_location_update": datetime.utcnow()
        }}
    )
    return {"success": True}

@api_router.post("/events", response_model=EventResponse)
async def create_event(
    event_data: EventCreate,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Create a new event"""
    event_doc = {
        "id": str(uuid.uuid4()),
        "title": event_data.title,
        "description": event_data.description,
        "location": {
            "latitude": event_data.latitude,
            "longitude": event_data.longitude,
            "city": event_data.city,
            "country": None
        },
        "address": event_data.address,
        "start_time": event_data.start_time,
        "end_time": event_data.end_time,
        "created_by": current_user.id,
        "attendees": [],
        "max_attendees": event_data.max_attendees,
        "image_url": event_data.image_url,
        "created_at": datetime.utcnow()
    }
    
    await database.events.insert_one(event_doc)
    
    return EventResponse(
        id=event_doc["id"],
        title=event_doc["title"],
        description=event_doc["description"],
        location=Location(**event_doc["location"]),
        address=event_doc["address"],
        start_time=event_doc["start_time"],
        end_time=event_doc["end_time"],
        created_by=event_doc["created_by"],
        attendees_count=0,
        max_attendees=event_doc["max_attendees"],
        image_url=event_doc["image_url"],
        is_attending=False
    )

@api_router.get("/events")
async def get_events(
    max_distance_km: Optional[float] = Query(default=None),
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get all events, optionally filtered by distance"""
    # Get current user location
    user = await database.users.find_one({"id": current_user.id})
    user_location = user.get("location") if user else None
    
    # Get all events
    events = await database.events.find().to_list(1000)
    
    # Filter by distance if user has location
    if user_location and user_location.get("latitude") and user_location.get("longitude"):
        events = filter_by_distance(
            events,
            user_location["latitude"],
            user_location["longitude"],
            max_distance_km
        )
    
    # Convert to response format
    results = []
    for event in events:
        is_attending = current_user.id in event.get("attendees", [])
        results.append(EventResponse(
            id=event["id"],
            title=event["title"],
            description=event["description"],
            location=Location(**event["location"]),
            address=event["address"],
            start_time=event["start_time"],
            end_time=event["end_time"],
            created_by=event["created_by"],
            attendees_count=len(event.get("attendees", [])),
            max_attendees=event.get("max_attendees"),
            image_url=event.get("image_url"),
            distance_km=event.get("distance_km"),
            is_attending=is_attending
        ))
    
    return results

@api_router.get("/events/nearby")
async def get_nearby_events(
    max_distance_km: float = Query(default=10.0),
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get events nearby user's current location"""
    # Get current user location
    user = await database.users.find_one({"id": current_user.id})
    user_location = user.get("location") if user else None
    
    if not user_location or not user_location.get("latitude"):
        return []
    
    # Get all events
    events = await database.events.find().to_list(1000)
    
    # Filter by distance
    nearby_events = filter_by_distance(
        events,
        user_location["latitude"],
        user_location["longitude"],
        max_distance_km
    )
    
    # Convert to response format
    results = []
    for event in nearby_events:
        is_attending = current_user.id in event.get("attendees", [])
        results.append(EventResponse(
            id=event["id"],
            title=event["title"],
            description=event["description"],
            location=Location(**event["location"]),
            address=event["address"],
            start_time=event["start_time"],
            end_time=event["end_time"],
            created_by=event["created_by"],
            attendees_count=len(event.get("attendees", [])),
            max_attendees=event.get("max_attendees"),
            image_url=event.get("image_url"),
            distance_km=event.get("distance_km"),
            is_attending=is_attending
        ))
    
    return results

@api_router.get("/events/{event_id}")
async def get_event_detail(
    event_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get event details"""
    event = await database.events.find_one({"id": event_id})
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Calculate distance if user has location
    user = await database.users.find_one({"id": current_user.id})
    user_location = user.get("location") if user else None
    distance_km = None
    
    if user_location and user_location.get("latitude"):
        distance_km = calculate_distance(
            user_location["latitude"],
            user_location["longitude"],
            event["location"]["latitude"],
            event["location"]["longitude"]
        )
    
    is_attending = current_user.id in event.get("attendees", [])
    
    return EventResponse(
        id=event["id"],
        title=event["title"],
        description=event["description"],
        location=Location(**event["location"]),
        address=event["address"],
        start_time=event["start_time"],
        end_time=event["end_time"],
        created_by=event["created_by"],
        attendees_count=len(event.get("attendees", [])),
        max_attendees=event.get("max_attendees"),
        image_url=event.get("image_url"),
        distance_km=distance_km,
        is_attending=is_attending
    )

@api_router.post("/events/{event_id}/attend")
async def attend_event(
    event_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Attend an event"""
    event = await database.events.find_one({"id": event_id})
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    attendees = event.get("attendees", [])
    
    # Check if already attending
    if current_user.id in attendees:
        return {"success": True, "message": "Already attending"}
    
    # Check max attendees
    if event.get("max_attendees") and len(attendees) >= event["max_attendees"]:
        raise HTTPException(status_code=400, detail="Event is full")
    
    # Add to attendees
    await database.events.update_one(
        {"id": event_id},
        {"$push": {"attendees": current_user.id}}
    )
    
    return {"success": True, "message": "Successfully joined event"}

@api_router.delete("/events/{event_id}/attend")
async def leave_event(
    event_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Leave an event"""
    await database.events.update_one(
        {"id": event_id},
        {"$pull": {"attendees": current_user.id}}
    )
    
    return {"success": True, "message": "Successfully left event"}

@api_router.get("/events/{event_id}/attendees")
async def get_event_attendees(
    event_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get list of event attendees"""
    event = await database.events.find_one({"id": event_id})
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    attendee_ids = event.get("attendees", [])

    if not attendee_ids:
        return {"attendees": [], "count": 0}

    users = await database.users.find({"id": {"$in": attendee_ids}}).to_list(len(attendee_ids))
    attendees = [
        {"id": u["id"], "name": u["name"], "age": u.get("age"), "city": u.get("city"), "photos": u.get("photos", [])}
        for u in users
    ]
    return {"attendees": attendees, "count": len(attendees)}

@api_router.post("/events/{event_id}/invite")
async def invite_matches_to_event(
    event_id: str,
    body: EventInviteCreate,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Invite one or more matches to an event."""
    event = await database.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    matches = await database.matches.find({
        "$or": [{"user1_id": current_user.id}, {"user2_id": current_user.id}]
    }).to_list(200)
    valid_match_ids = set()
    for m in matches:
        other = m["user2_id"] if m["user1_id"] == current_user.id else m["user1_id"]
        valid_match_ids.add(other)

    invites_created = []
    for invitee_id in body.match_ids:
        if invitee_id not in valid_match_ids:
            continue
        existing = await database.event_invites.find_one({
            "event_id": event_id, "inviter_id": current_user.id, "invitee_id": invitee_id
        })
        if existing:
            continue
        invite_doc = {
            "id": str(uuid.uuid4()),
            "event_id": event_id,
            "inviter_id": current_user.id,
            "invitee_id": invitee_id,
            "status": "pending",
            "created_at": datetime.utcnow()
        }
        await database.event_invites.insert_one(invite_doc)

        await database.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": invitee_id,
            "notification_type": NotificationType.EVENT_INVITE,
            "title": "Sei stato invitato a un evento!",
            "message": f"{current_user.name} ti ha invitato a '{event['title']}'",
            "read": False,
            "created_at": datetime.utcnow(),
            "data": {"event_id": event_id, "invite_id": invite_doc["id"], "inviter_name": current_user.name}
        })

        invites_created.append(invite_doc["id"])
        logger.info("Event invite sent from %s to %s for event %s", current_user.id, invitee_id, event_id)

    return {"success": True, "invites_created": len(invites_created)}


@api_router.put("/events/{event_id}/invite/{invite_id}")
async def respond_to_event_invite(
    event_id: str,
    invite_id: str,
    body: EventInviteStatusUpdate,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Accept or decline an event invite."""
    if body.status not in ("accepted", "declined"):
        raise HTTPException(status_code=400, detail="status must be 'accepted' or 'declined'")

    invite = await database.event_invites.find_one({
        "id": invite_id, "event_id": event_id, "invitee_id": current_user.id
    })
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    await database.event_invites.update_one(
        {"id": invite_id},
        {"$set": {"status": body.status, "responded_at": datetime.utcnow()}}
    )

    if body.status == "accepted":
        await database.events.update_one(
            {"id": event_id},
            {"$addToSet": {"attendees": current_user.id}}
        )
        event = await database.events.find_one({"id": event_id})
        await database.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": invite["inviter_id"],
            "notification_type": NotificationType.EVENT_INVITE_ACCEPTED,
            "title": "Il tuo invito è stato accettato!",
            "message": f"{current_user.name} parteciperà all'evento '{event['title'] if event else ''}'",
            "read": False,
            "created_at": datetime.utcnow(),
            "data": {"event_id": event_id, "invitee_name": current_user.name}
        })

    logger.info("Invite %s %s by user %s", invite_id, body.status, current_user.id)
    return {"success": True, "status": body.status}


@api_router.get("/events/{event_id}/invites")
async def get_event_invites(
    event_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get all invites sent or received for an event by the current user."""
    invites = await database.event_invites.find({
        "event_id": event_id,
        "$or": [{"inviter_id": current_user.id}, {"invitee_id": current_user.id}]
    }).to_list(100)
    return [EventInvite(**inv) for inv in invites]

# ===== SOCIAL & GAMIFICATION ROUTES =====
@api_router.post("/stories")
async def create_story(
    story_data: StoryCreate,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Create a story (expires in 24h)"""
    from datetime import timedelta
    
    story_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "media_url": story_data.media_url,
        "media_type": story_data.media_type,
        "caption": story_data.caption,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(hours=24),
        "views": []
    }
    
    await database.stories.insert_one(story_doc)
    return Story(**story_doc)

@api_router.get("/stories")
async def get_active_stories(
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get all active stories (not expired)"""
    now = datetime.utcnow()

    stories = await database.stories.find({
        "expires_at": {"$gt": now}
    }).sort("created_at", -1).to_list(200)

    if not stories:
        return []

    user_ids = list({s["user_id"] for s in stories})
    users_cursor = await database.users.find({"id": {"$in": user_ids}}).to_list(len(user_ids))
    users_map = {u["id"]: u for u in users_cursor}

    stories_by_user = {}
    for story in stories:
        user_id = story["user_id"]
        if user_id not in stories_by_user:
            u = users_map.get(user_id, {})
            stories_by_user[user_id] = {
                "user_id": user_id,
                "user_name": u.get("name", "Unknown"),
                "user_photo": u.get("photos", [None])[0] if u.get("photos") else None,
                "stories": []
            }
        stories_by_user[user_id]["stories"].append(Story(**story))

    return list(stories_by_user.values())

@api_router.get("/stories/{user_id}")
async def get_user_stories(
    user_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get stories from a specific user"""
    now = datetime.utcnow()
    
    stories = await database.stories.find({
        "user_id": user_id,
        "expires_at": {"$gt": now}
    }).sort("created_at", 1).to_list(100)
    
    # Mark as viewed
    for story in stories:
        if current_user.id not in story.get("views", []):
            await database.stories.update_one(
                {"id": story["id"]},
                {"$push": {"views": current_user.id}}
            )
    
    return [Story(**s) for s in stories]

@api_router.delete("/stories/{story_id}")
async def delete_story(
    story_id: str,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Delete own story"""
    result = await database.stories.delete_one({
        "id": story_id,
        "user_id": current_user.id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Story not found")
    
    return {"success": True}

@api_router.get("/badges")
async def get_user_badges(
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get user's badges"""
    # Check and award new badges
    await check_and_award_badges(database, current_user.id)
    
    # Get all badges
    badges = await database.badges.find({
        "user_id": current_user.id
    }).sort("earned_at", -1).to_list(100)
    
    return [Badge(**b) for b in badges]

@api_router.post("/referrals/generate")
async def generate_referral(
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Generate referral code for user"""
    code = await create_referral_code(database, current_user.id)
    return {"code": code, "share_url": f"https://bpmsocial.app/join?ref={code}"}

@api_router.post("/referrals/redeem")
async def redeem_referral(
    redemption: ReferralRedemption,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Redeem a referral code"""
    success = await redeem_referral_code(database, redemption.code, current_user.id)
    
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired referral code")
    
    return {"success": True, "message": "Referral code redeemed! You've earned a badge!"}

@api_router.get("/referrals/stats")
async def get_referral_stats(
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get referral statistics"""
    referral = await database.referral_codes.find_one({"referrer_id": current_user.id})
    
    if not referral:
        return {"code": None, "referred_count": 0, "referred_users": []}
    
    return {
        "code": referral["code"],
        "referred_count": len(referral.get("referred_users", [])),
        "referred_users": referral.get("referred_users", [])
    }

# ===== PREMIUM & SECURITY ROUTES =====
@api_router.post("/users/verify")
async def request_verification(
    verification: dict,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Request identity verification with selfie"""
    # In production, this would verify the selfie with AI
    await database.users.update_one(
        {"id": current_user.id},
        {"$set": {"verified": True, "verification_requested_at": datetime.utcnow()}}
    )
    
    return {"success": True, "message": "Verification request submitted"}

@api_router.put("/users/incognito")
async def toggle_incognito_mode(
    enabled: dict,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Toggle incognito mode"""
    await database.users.update_one(
        {"id": current_user.id},
        {"$set": {"incognito_mode": enabled.get("enabled", False)}}
    )
    
    return {"success": True, "incognito_enabled": enabled.get("enabled", False)}

@api_router.post("/premium/subscribe")
async def subscribe_premium(
    subscription_data: dict,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Subscribe to premium (mock Stripe integration)"""
    from datetime import timedelta
    
    plan_type = subscription_data.get("plan_type", "monthly")
    
    # Mock subscription creation
    duration = timedelta(days=365 if plan_type == "yearly" else 30)
    
    subscription_doc = {
        "user_id": current_user.id,
        "plan_type": plan_type,
        "start_date": datetime.utcnow(),
        "end_date": datetime.utcnow() + duration,
        "active": True
    }
    
    await database.subscriptions.insert_one(subscription_doc)
    await database.users.update_one(
        {"id": current_user.id},
        {"$set": {"premium": True}}
    )
    
    return {"success": True, "message": "Premium subscription activated!"}

@api_router.get("/premium/status")
async def get_premium_status(
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get premium subscription status"""
    subscription = await database.subscriptions.find_one({
        "user_id": current_user.id,
        "active": True
    })
    
    if not subscription:
        return {"premium": False, "subscription": None}
    
    return {
        "premium": True,
        "subscription": {
            "plan_type": subscription["plan_type"],
            "start_date": subscription["start_date"].isoformat(),
            "end_date": subscription["end_date"].isoformat()
        }
    }

# ===== SETTINGS & PREFERENCES ROUTES =====
@api_router.put("/users/preferences")
async def update_user_preferences(
    preferences: dict,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Update user preferences and filters"""
    allowed_fields = [
        "age_min", "age_max", "distance_max", "height_min", "height_max",
        "lifestyle", "smoker_preference", "show_me", "dark_mode"
    ]
    
    update_dict = {k: v for k, v in preferences.items() if k in allowed_fields}
    
    if update_dict:
        await database.users.update_one(
            {"id": current_user.id},
            {"$set": {"preferences": update_dict}}
        )
    
    return {"success": True}

@api_router.put("/users/pause-account")
async def pause_account(
    paused: dict,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Pause account temporarily"""
    await database.users.update_one(
        {"id": current_user.id},
        {"$set": {
            "account_paused": paused.get("paused", True),
            "paused_at": datetime.utcnow() if paused.get("paused") else None
        }}
    )
    
    return {"success": True, "paused": paused.get("paused", True)}

@api_router.get("/users/preferences")
async def get_user_preferences(
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get user preferences"""
    user = await database.users.find_one({"id": current_user.id})
    
    return user.get("preferences", {
        "age_min": 18,
        "age_max": 99,
        "distance_max": 50,
        "dark_mode": True
    })

# Include the router in the main app
fastapi_app.include_router(api_router)


# ─── SUPER ADMIN DEPENDENCY ───────────────────────────────────────────────────

async def require_superadmin(current_user: UserResponse = Depends(get_current_user_dependency)):
    if current_user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")
    return current_user


# ─── ADMIN ROUTER ──────────────────────────────────────────────────────────────

admin_router = APIRouter(prefix="/api/admin", tags=["admin"])


@admin_router.get("/users")
async def admin_list_users(
    skip: int = 0, limit: int = 50,
    search: Optional[str] = None,
    _admin=Depends(require_superadmin),
    database=Depends(get_db)
):
    query = {}
    if search:
        query = {"$or": [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]}
    users = await database.users.find(query, {"password_hash": 0}).skip(skip).limit(limit).to_list(limit)
    total = await database.users.count_documents(query)
    for u in users:
        u.pop("_id", None)
    return {"users": users, "total": total, "skip": skip, "limit": limit}


@admin_router.get("/users/{user_id}")
async def admin_get_user(user_id: str, _admin=Depends(require_superadmin), database=Depends(get_db)):
    user = await database.users.find_one({"id": user_id}, {"password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.pop("_id", None)
    return user


@admin_router.patch("/users/{user_id}/role")
async def admin_set_role(
    user_id: str,
    body: dict,
    _admin=Depends(require_superadmin),
    database=Depends(get_db)
):
    role = body.get("role")
    if role not in ("user", "admin", "superadmin"):
        raise HTTPException(status_code=400, detail="Invalid role. Use: user, admin, superadmin")
    result = await database.users.update_one({"id": user_id}, {"$set": {"role": role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"Role updated to '{role}'", "user_id": user_id}


@admin_router.patch("/users/{user_id}/ban")
async def admin_ban_user(user_id: str, _admin=Depends(require_superadmin), database=Depends(get_db)):
    result = await database.users.update_one({"id": user_id}, {"$set": {"banned": True, "role": "banned"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User banned", "user_id": user_id}


@admin_router.patch("/users/{user_id}/unban")
async def admin_unban_user(user_id: str, _admin=Depends(require_superadmin), database=Depends(get_db)):
    result = await database.users.update_one({"id": user_id}, {"$set": {"banned": False, "role": "user"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User unbanned", "user_id": user_id}


@admin_router.patch("/users/{user_id}/premium")
async def admin_set_premium(
    user_id: str,
    body: dict,
    _admin=Depends(require_superadmin),
    database=Depends(get_db)
):
    premium = body.get("premium", True)
    result = await database.users.update_one({"id": user_id}, {"$set": {"premium": premium}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"Premium set to {premium}", "user_id": user_id}


@admin_router.delete("/users/{user_id}")
async def admin_delete_user(user_id: str, _admin=Depends(require_superadmin), database=Depends(get_db)):
    await database.users.delete_one({"id": user_id})
    await database.swipes.delete_many({"$or": [{"user_id": user_id}, {"profile_id": user_id}]})
    await database.matches.delete_many({"$or": [{"user1_id": user_id}, {"user2_id": user_id}]})
    return {"message": "User deleted", "user_id": user_id}


@admin_router.get("/stats")
async def admin_stats(_admin=Depends(require_superadmin), database=Depends(get_db)):
    total_users = await database.users.count_documents({})
    total_matches = await database.matches.count_documents({})
    total_messages = await database.messages.count_documents({})
    total_swipes = await database.swipes.count_documents({})
    premium_users = await database.users.count_documents({"premium": True})
    banned_users = await database.users.count_documents({"banned": True})
    admins = await database.users.count_documents({"role": {"$in": ["admin", "superadmin"]}})
    return {
        "total_users": total_users,
        "premium_users": premium_users,
        "banned_users": banned_users,
        "admins": admins,
        "total_matches": total_matches,
        "total_messages": total_messages,
        "total_swipes": total_swipes,
    }


fastapi_app.include_router(admin_router)


# ─── BOOTSTRAP SUPERADMIN (usa solo una volta) ────────────────────────────────

BOOTSTRAP_SECRET = "SyncLove_bootstrap_2026"

@fastapi_app.post("/api/bootstrap/superadmin")
async def bootstrap_superadmin(body: dict, database=Depends(get_db)):
    secret = body.get("secret")
    email = body.get("email")
    if secret != BOOTSTRAP_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret")
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    user = await database.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail=f"No user with email '{email}'")
    await database.users.update_one(
        {"email": email},
        {"$set": {"role": "superadmin", "verified": True, "premium": True}}
    )
    return {
        "message": "Superadmin promoted successfully",
        "user_id": user["id"],
        "name": user["name"],
        "email": email,
        "role": "superadmin"
    }




# ─── EVENTS ────────────────────────────────────────────────────────────────────

events_router = APIRouter(prefix="/api/events", tags=["events"])

import math as _math

def _haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = _math.radians(lat2 - lat1)
    dlon = _math.radians(lon2 - lon1)
    a = _math.sin(dlat/2)**2 + _math.cos(_math.radians(lat1)) * _math.cos(_math.radians(lat2)) * _math.sin(dlon/2)**2
    return R * 2 * _math.atan2(_math.sqrt(a), _math.sqrt(1-a))

@events_router.post("", status_code=201)
async def create_event(
    event_data: EventCreate,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database=Depends(get_db)
):
    event = {
        "id": str(uuid.uuid4()),
        "title": event_data.title,
        "description": event_data.description,
        "location": {"latitude": event_data.latitude, "longitude": event_data.longitude, "city": event_data.city},
        "address": event_data.address,
        "event_type": event_data.event_type,
        "start_time": event_data.start_time,
        "end_time": event_data.end_time,
        "created_by": current_user.id,
        "created_by_name": current_user.name,
        "attendees": [current_user.id],
        "max_attendees": event_data.max_attendees,
        "image_url": event_data.image_url,
        "created_at": datetime.utcnow(),
    }
    await database.events.insert_one(event)
    event.pop("_id", None)
    return event

@events_router.get("")
async def list_events(
    city: Optional[str] = None,
    event_type: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius_km: float = 50,
    skip: int = 0,
    limit: int = 20,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database=Depends(get_db)
):
    query: dict = {"start_time": {"$gte": datetime.utcnow()}}
    if city:
        query["location.city"] = {"$regex": city, "$options": "i"}
    if event_type:
        query["event_type"] = event_type
    events = await database.events.find(query).sort("start_time", 1).skip(skip).limit(limit).to_list(limit)
    total = await database.events.count_documents(query)
    result = []
    for e in events:
        e.pop("_id", None)
        dist = None
        if lat and lon and e.get("location"):
            dist = round(_haversine(lat, lon, e["location"]["latitude"], e["location"]["longitude"]), 1)
        result.append({**e, "attendees_count": len(e.get("attendees", [])), "is_attending": current_user.id in e.get("attendees", []), "distance_km": dist})
    return {"events": result, "total": total}

@events_router.get("/my")
async def my_events(current_user: UserResponse = Depends(get_current_user_dependency), database=Depends(get_db)):
    created = await database.events.find({"created_by": current_user.id}).sort("start_time", 1).to_list(50)
    attending = await database.events.find({"attendees": current_user.id, "created_by": {"$ne": current_user.id}}).sort("start_time", 1).to_list(50)
    invites = await database.event_invites.find({"invitee_id": current_user.id, "status": "pending"}).to_list(20)
    for doc in created + attending:
        doc.pop("_id", None)
        doc["attendees_count"] = len(doc.get("attendees", []))
        doc["is_attending"] = True
    for doc in invites:
        doc.pop("_id", None)
    return {"created": created, "attending": attending, "invites": invites}

@events_router.get("/{event_id}")
async def get_event(event_id: str, current_user: UserResponse = Depends(get_current_user_dependency), database=Depends(get_db)):
    event = await database.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.pop("_id", None)
    event["attendees_count"] = len(event.get("attendees", []))
    event["is_attending"] = current_user.id in event.get("attendees", [])
    # get attendees details
    attendee_ids = event.get("attendees", [])[:10]
    attendees_detail = []
    if attendee_ids:
        users = await database.users.find({"id": {"$in": attendee_ids}}, {"password_hash": 0, "_id": 0}).to_list(10)
        attendees_detail = [{"id": u["id"], "name": u["name"], "photos": u.get("photos", [])} for u in users]
    event["attendees_detail"] = attendees_detail
    return event

@events_router.post("/{event_id}/rsvp")
async def rsvp_event(event_id: str, current_user: UserResponse = Depends(get_current_user_dependency), database=Depends(get_db)):
    event = await database.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    attending = current_user.id in event.get("attendees", [])
    if attending:
        await database.events.update_one({"id": event_id}, {"$pull": {"attendees": current_user.id}})
        return {"attending": False, "message": "Rimosso dalla lista partecipanti"}
    max_a = event.get("max_attendees")
    if max_a and len(event.get("attendees", [])) >= max_a:
        raise HTTPException(status_code=400, detail="Evento al completo")
    await database.events.update_one({"id": event_id}, {"$addToSet": {"attendees": current_user.id}})
    return {"attending": True, "message": "Sei iscritto all'evento!"}

@events_router.post("/{event_id}/invite")
async def invite_to_event(
    event_id: str,
    body: EventInviteCreate,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database=Depends(get_db)
):
    event = await database.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    # verify they are matches
    match_ids = body.match_ids
    matches = await database.matches.find({
        "$or": [
            {"user1_id": current_user.id, "user2_id": {"$in": match_ids}},
            {"user2_id": current_user.id, "user1_id": {"$in": match_ids}}
        ]
    }).to_list(len(match_ids))
    valid_ids = set()
    for m in matches:
        other = m["user2_id"] if m["user1_id"] == current_user.id else m["user1_id"]
        valid_ids.add(other)
    sent = []
    for uid in valid_ids:
        existing = await database.event_invites.find_one({"event_id": event_id, "invitee_id": uid})
        if not existing:
            invite = {"id": str(uuid.uuid4()), "event_id": event_id, "inviter_id": current_user.id, "invitee_id": uid, "status": "pending", "created_at": datetime.utcnow()}
            await database.event_invites.insert_one(invite)
            sent.append(uid)
    return {"sent": len(sent), "invited_ids": sent}

@events_router.patch("/{event_id}/invite/{invite_id}")
async def respond_invite(
    event_id: str,
    invite_id: str,
    body: EventInviteStatusUpdate,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database=Depends(get_db)
):
    invite = await database.event_invites.find_one({"id": invite_id, "invitee_id": current_user.id})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if body.status not in ("accepted", "declined"):
        raise HTTPException(status_code=400, detail="Status must be accepted or declined")
    await database.event_invites.update_one({"id": invite_id}, {"$set": {"status": body.status}})
    if body.status == "accepted":
        await database.events.update_one({"id": event_id}, {"$addToSet": {"attendees": current_user.id}})
    return {"status": body.status}

@events_router.delete("/{event_id}")
async def delete_event(event_id: str, current_user: UserResponse = Depends(get_current_user_dependency), database=Depends(get_db)):
    event = await database.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["created_by"] != current_user.id and current_user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Non sei il creatore dell'evento")
    await database.events.delete_one({"id": event_id})
    await database.event_invites.delete_many({"event_id": event_id})
    return {"message": "Evento eliminato"}

fastapi_app.include_router(events_router)


@fastapi_app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Import socket server and create Socket.IO ASGI app
from socket_server import sio
app = socketio.ASGIApp(sio, fastapi_app)

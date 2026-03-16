from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Query
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
from models import (
    UserCreate, UserLogin, TokenResponse, UserResponse, UserUpdate, 
    Match, ChatMessage, ChatMessageCreate, Notification, FCMToken,
    HeartRateReading, HeartRateReadingCreate, EmotionalReactionDB, EmotionalReactionCreate,
    BiometricStats, TopReaction
)
from auth import register_user, login_user
from dependencies import get_current_user_dependency, get_db
from notifications import (
    get_unread_count, mark_as_read, mark_all_as_read,
    notify_new_match, notify_new_message
)
from biometrics import (
    calculate_stats, get_top_reactions, get_bpm_timeline,
    get_reactions_history, get_weekly_summary
)
import socketio


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main FastAPI app
fastapi_app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


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
async def register(user_data: UserCreate, database = Depends(get_db)):
    """Register a new user"""
    user = await register_user(user_data, database)
    # Auto-login after registration
    from models import UserLogin
    login_data = UserLogin(email=user_data.email, password=user_data.password)
    return await login_user(login_data, database)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(login_data: UserLogin, database = Depends(get_db)):
    """Login user"""
    return await login_user(login_data, database)

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

@api_router.get("/chat/matches", response_model=List[Match])
async def get_user_matches(
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Get all matches for current user"""
    matches = await database.matches.find({
        "$or": [
            {"user1_id": current_user.id},
            {"user2_id": current_user.id}
        ]
    }).to_list(1000)
    return [Match(**match) for match in matches]

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

# Include the router in the main app
fastapi_app.include_router(api_router)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@fastapi_app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Import socket server and create Socket.IO ASGI app
from socket_server import sio
app = socketio.ASGIApp(sio, fastapi_app)

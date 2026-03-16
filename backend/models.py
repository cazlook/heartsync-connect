from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime
import uuid

# User Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    age: Optional[int] = None
    bio: Optional[str] = None
    city: Optional[str] = None
    interests: List[str] = []
    photos: List[str] = []
    
class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: str
    created_at: datetime
    verified: bool = False
    premium: bool = False
    
class UserUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    bio: Optional[str] = None
    city: Optional[str] = None
    interests: Optional[List[str]] = None
    photos: Optional[List[str]] = None

class User(UserResponse):
    password_hash: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Profile Models
class HeartRateReaction(BaseModel):
    profile_id: str
    bpm_delta: int
    timestamp: datetime
    intensity: str  # low, medium, high

# Biometric Models
class HeartRateReading(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    bpm: int
    context: str = "browsing"  # browsing, chatting, event
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class HeartRateReadingCreate(BaseModel):
    bpm: int
    context: str = "browsing"

class EmotionalReactionDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    profile_id: str
    profile_name: str
    bpm_before: int
    bpm_peak: int
    bpm_delta: int
    intensity: str  # low, medium, high
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class EmotionalReactionCreate(BaseModel):
    profile_id: str
    profile_name: str
    bpm_before: int
    bpm_peak: int
    bpm_delta: int
    intensity: str

class BiometricStats(BaseModel):
    total_readings: int
    avg_bpm: float
    max_bpm: int
    min_bpm: int
    total_reactions: int
    avg_reaction_intensity: float
    most_reactive_time: Optional[str] = None

class TopReaction(BaseModel):
    profile_id: str
    profile_name: str
    bpm_delta: int
    intensity: str
    timestamp: datetime
    reaction_count: int

class Match(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user1_id: str
    user2_id: str
    cardiac_score: int
    matched_at: datetime = Field(default_factory=datetime.utcnow)
    
# Chat Models
class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    match_id: str
    sender_id: str
    message: str
    message_type: str = "text"  # text, voice, gif, reaction
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    read: bool = False

class ChatMessageCreate(BaseModel):
    message: str
    message_type: str = "text"

# Notification Models
class NotificationType:
    NEW_MATCH = "new_match"
    NEW_MESSAGE = "new_message"
    NEW_EVENT = "new_event"
    MATCH_LIKED_YOU = "match_liked_you"
    EVENT_REMINDER = "event_reminder"

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    notification_type: str
    title: str
    message: str
    read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    data: dict = {}  # Extra data like match_id, message_id, event_id
    
class NotificationCreate(BaseModel):
    user_id: str
    notification_type: str
    title: str
    message: str
    data: dict = {}

class FCMToken(BaseModel):
    user_id: str
    token: str
    device_type: str = "web"  # web, ios, android
    created_at: datetime = Field(default_factory=datetime.utcnow)


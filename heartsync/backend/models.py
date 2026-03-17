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

# Location & Events Models
class Location(BaseModel):
    latitude: float
    longitude: float
    city: Optional[str] = None
    country: Optional[str] = None

class Event(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    location: Location
    address: str
    start_time: datetime
    end_time: datetime
    created_by: str
    attendees: List[str] = []
    max_attendees: Optional[int] = None
    image_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class EventCreate(BaseModel):
    title: str
    description: str
    latitude: float
    longitude: float
    address: str
    city: Optional[str] = None
    start_time: datetime
    end_time: datetime
    max_attendees: Optional[int] = None
    image_url: Optional[str] = None

class EventResponse(BaseModel):
    id: str
    title: str
    description: str
    location: Location
    address: str
    start_time: datetime
    end_time: datetime
    created_by: str
    attendees_count: int
    max_attendees: Optional[int] = None
    image_url: Optional[str] = None
    distance_km: Optional[float] = None
    is_attending: bool = False

class UserLocationUpdate(BaseModel):
    latitude: float
    longitude: float
    city: Optional[str] = None
    country: Optional[str] = None

# Social & Gamification Models
class Story(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    media_url: str
    media_type: str = "image"  # image, video
    caption: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    views: List[str] = []  # user_ids who viewed

class StoryCreate(BaseModel):
    media_url: str
    media_type: str = "image"
    caption: Optional[str] = None

class BadgeType:
    FIRST_MATCH = "first_match"
    FIRST_MESSAGE = "first_message"
    TEN_EVENTS = "ten_events"
    CARDIAC_CONNECTION = "cardiac_connection"
    SOCIAL_BUTTERFLY = "social_butterfly"
    EARLY_ADOPTER = "early_adopter"

class Badge(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    badge_type: str
    title: str
    description: str
    icon: str
    earned_at: datetime = Field(default_factory=datetime.utcnow)

class ReferralCode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    referrer_id: str
    referred_users: List[str] = []
    max_uses: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ReferralRedemption(BaseModel):
    code: str

# Premium & Security Models  
class VerificationRequest(BaseModel):
    selfie_url: str

class PremiumSubscription(BaseModel):
    user_id: str
    plan_type: str  # monthly, yearly
    start_date: datetime
    end_date: datetime
    active: bool = True


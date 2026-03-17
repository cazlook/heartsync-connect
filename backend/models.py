from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime
import uuid
from enum import Enum

# ===== USER MODELS =====
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
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse

class RefreshTokenRequest(BaseModel):
    refresh_token: str

# ===== TOKEN BLACKLIST =====
class TokenBlacklist(BaseModel):
    """Revoked tokens stored in DB for logout invalidation"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    jti: str  # JWT ID claim
    user_id: str
    revoked_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime

# ===== PROFILE MODELS =====
class HeartRateReaction(BaseModel):
    profile_id: str
    bpm_delta: int
    timestamp: datetime
    intensity: str  # low, medium, high

# ===== BIOMETRIC MODELS =====
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

# ===== MATCH MODELS =====
class Match(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user1_id: str
    user2_id: str
    cardiac_score: float  # 0-100, calcolato dall'algoritmo reale
    bpm_delta_avg: Optional[float] = None  # Delta BPM medio tra i due utenti
    reaction_intensity_avg: Optional[float] = None
    matched_at: datetime = Field(default_factory=datetime.utcnow)

class MatchScore(BaseModel):
    """Risultato dell'algoritmo di matching cardiaco"""
    user1_id: str
    user2_id: str
    cardiac_score: float
    bpm_delta_avg: float
    reaction_intensity_avg: float
    compatibility_level: str  # low, medium, high, exceptional

# ===== CHAT MODELS =====
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

# ===== NOTIFICATION MODELS =====
class NotificationType:
    NEW_MATCH = "new_match"
    NEW_MESSAGE = "new_message"
    NEW_EVENT = "new_event"
    MATCH_LIKED_YOU = "match_liked_you"
    EVENT_REMINDER = "event_reminder"
    EVENT_INVITE = "event_invite"
    EVENT_INVITE_ACCEPTED = "event_invite_accepted"
    EVENT_INVITE_DECLINED = "event_invite_declined"

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

# ===== LOCATION & EVENT MODELS =====
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

# ===== EVENT INVITE MODELS =====
class InviteStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"

class EventInvite(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_id: str
    inviter_id: str
    invitee_id: str
    status: InviteStatus = InviteStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

class EventInviteCreate(BaseModel):
    """Payload per invitare uno o piu' match a un evento"""
    match_ids: List[str]  # lista di user_id dei match da invitare

class EventInviteResponse(BaseModel):
    invite: EventInvite
    inviter_name: str
    invitee_name: str
    event_title: str

class EventInviteStatusUpdate(BaseModel):
    status: InviteStatus  # accepted o declined

# ===== SOCIAL & GAMIFICATION MODELS =====
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

# ===== PREMIUM & SECURITY MODELS =====
class VerificationRequest(BaseModel):
    selfie_url: str

class VerificationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class IdentityVerification(BaseModel):
    """Record verifica identita' in attesa di revisione AI/manuale"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    selfie_url: str
    status: VerificationStatus = VerificationStatus.PENDING
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None

class PremiumSubscription(BaseModel):
    user_id: str
    plan_type: str  # monthly, yearly
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    start_date: datetime
    end_date: datetime
    active: bool = True

class StripeWebhookEvent(BaseModel):
    """Payload ricevuto da Stripe webhook"""
    type: str
    data: dict

# ===== MEDIA UPLOAD MODELS =====
class UploadPresignedUrl(BaseModel):
    """URL pre-firmato S3 per upload diretto dal client"""
    upload_url: str
    file_key: str
    public_url: str
    expires_in: int  # secondi

class MediaUploadRequest(BaseModel):
    file_name: str
    content_type: str  # image/jpeg, image/png, video/mp4
    upload_type: str  # story, profile_photo

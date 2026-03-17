from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import Badge, BadgeType
import uuid
import random
import string

BADGE_DEFINITIONS = {
    BadgeType.FIRST_MATCH: {
        "title": "Prima Connessione ❤️",
        "description": "Hai fatto il tuo primo match!",
        "icon": "❤️"
    },
    BadgeType.FIRST_MESSAGE: {
        "title": "Primo Messaggio 💬",
        "description": "Hai inviato il tuo primo messaggio!",
        "icon": "💬"
    },
    BadgeType.TEN_EVENTS: {
        "title": "Party Animal 🎉",
        "description": "Hai partecipato a 10 eventi!",
        "icon": "🎉"
    },
    BadgeType.CARDIAC_CONNECTION: {
        "title": "Connessione Cardiaca 💓",
        "description": "Hai avuto una reazione ad alta intensità!",
        "icon": "💓"
    },
    BadgeType.SOCIAL_BUTTERFLY: {
        "title": "Farfalla Sociale 🦋",
        "description": "Hai più di 50 match!",
        "icon": "🦋"
    },
    BadgeType.EARLY_ADOPTER: {
        "title": "Early Adopter 🚀",
        "description": "Sei tra i primi utenti!",
        "icon": "🚀"
    }
}

async def award_badge(db: AsyncIOMotorDatabase, user_id: str, badge_type: str) -> Badge:
    """Award a badge to a user if they don't already have it"""
    # Check if user already has this badge
    existing = await db.badges.find_one({
        "user_id": user_id,
        "badge_type": badge_type
    })
    
    if existing:
        return Badge(**existing)
    
    # Create badge
    badge_info = BADGE_DEFINITIONS.get(badge_type, {
        "title": "Badge",
        "description": "Achievement unlocked!",
        "icon": "🏆"
    })
    
    badge_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "badge_type": badge_type,
        "title": badge_info["title"],
        "description": badge_info["description"],
        "icon": badge_info["icon"],
        "earned_at": datetime.utcnow()
    }
    
    await db.badges.insert_one(badge_doc)
    
    return Badge(**badge_doc)

async def check_and_award_badges(db: AsyncIOMotorDatabase, user_id: str):
    """Check user progress and award appropriate badges"""
    badges_awarded = []
    
    # Check for first match
    match_count = await db.matches.count_documents({
        "$or": [{"user1_id": user_id}, {"user2_id": user_id}]
    })
    if match_count >= 1:
        badge = await award_badge(db, user_id, BadgeType.FIRST_MATCH)
        if badge:
            badges_awarded.append(badge)
    
    # Check for social butterfly (50+ matches)
    if match_count >= 50:
        badge = await award_badge(db, user_id, BadgeType.SOCIAL_BUTTERFLY)
        if badge:
            badges_awarded.append(badge)
    
    # Check for first message
    message_count = await db.messages.count_documents({"sender_id": user_id})
    if message_count >= 1:
        badge = await award_badge(db, user_id, BadgeType.FIRST_MESSAGE)
        if badge:
            badges_awarded.append(badge)
    
    # Check for event participation
    event_count = await db.events.count_documents({"attendees": user_id})
    if event_count >= 10:
        badge = await award_badge(db, user_id, BadgeType.TEN_EVENTS)
        if badge:
            badges_awarded.append(badge)
    
    # Check for cardiac connection (high intensity reaction)
    high_intensity = await db.emotional_reactions.find_one({
        "user_id": user_id,
        "intensity": "high"
    })
    if high_intensity:
        badge = await award_badge(db, user_id, BadgeType.CARDIAC_CONNECTION)
        if badge:
            badges_awarded.append(badge)
    
    return badges_awarded

def generate_referral_code() -> str:
    """Generate a unique referral code"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

async def create_referral_code(db: AsyncIOMotorDatabase, user_id: str) -> str:
    """Create a referral code for a user"""
    # Check if user already has a code
    existing = await db.referral_codes.find_one({"referrer_id": user_id})
    if existing:
        return existing["code"]
    
    # Generate new code
    code = generate_referral_code()
    
    # Ensure code is unique
    while await db.referral_codes.find_one({"code": code}):
        code = generate_referral_code()
    
    # Create referral code
    referral_doc = {
        "id": str(uuid.uuid4()),
        "code": code,
        "referrer_id": user_id,
        "referred_users": [],
        "max_uses": None,
        "created_at": datetime.utcnow()
    }
    
    await db.referral_codes.insert_one(referral_doc)
    
    return code

async def redeem_referral_code(db: AsyncIOMotorDatabase, code: str, new_user_id: str) -> bool:
    """Redeem a referral code"""
    # Find code
    referral = await db.referral_codes.find_one({"code": code.upper()})
    
    if not referral:
        return False
    
    # Check if already used by this user
    if new_user_id in referral.get("referred_users", []):
        return False
    
    # Check max uses
    if referral.get("max_uses") and len(referral.get("referred_users", [])) >= referral["max_uses"]:
        return False
    
    # Add user to referred users
    await db.referral_codes.update_one(
        {"code": code.upper()},
        {"$push": {"referred_users": new_user_id}}
    )
    
    # Award badges to both users
    await award_badge(db, referral["referrer_id"], BadgeType.SOCIAL_BUTTERFLY)
    await award_badge(db, new_user_id, BadgeType.EARLY_ADOPTER)
    
    return True

import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import Notification, NotificationCreate, NotificationType
import uuid

# Mock Firebase Cloud Messaging for development
class MockFirebaseMessaging:
    """Mock FCM for development without real Firebase keys"""
    
    @staticmethod
    async def send_notification(token: str, title: str, body: str, data: dict = None):
        """Mock sending push notification"""
        print(f"[MOCK FCM] Sending notification to token {token[:20]}...")
        print(f"  Title: {title}")
        print(f"  Body: {body}")
        print(f"  Data: {data}")
        # In production, this would use Firebase Admin SDK:
        # message = messaging.Message(
        #     notification=messaging.Notification(title=title, body=body),
        #     data=data or {},
        #     token=token
        # )
        # response = messaging.send(message)
        return {"success": True, "mock": True}

fcm = MockFirebaseMessaging()

async def create_notification(
    db: AsyncIOMotorDatabase,
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    data: dict = None
) -> Notification:
    """Create a new notification"""
    notification_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "notification_type": notification_type,
        "title": title,
        "message": message,
        "read": False,
        "created_at": datetime.utcnow(),
        "data": data or {}
    }
    
    await db.notifications.insert_one(notification_doc)
    
    # Try to send push notification if user has FCM token
    token_doc = await db.fcm_tokens.find_one({"user_id": user_id})
    if token_doc:
        try:
            await fcm.send_notification(
                token=token_doc["token"],
                title=title,
                body=message,
                data=data or {}
            )
        except Exception as e:
            print(f"Error sending push notification: {e}")
    
    return Notification(**notification_doc)

async def notify_new_match(db: AsyncIOMotorDatabase, user_id: str, match_id: str, other_user_name: str):
    """Notify user about new match"""
    return await create_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.NEW_MATCH,
        title="Nuovo Match! 💕",
        message=f"Hai un nuovo match con {other_user_name}!",
        data={"match_id": match_id}
    )

async def notify_new_message(db: AsyncIOMotorDatabase, user_id: str, sender_name: str, match_id: str):
    """Notify user about new message"""
    return await create_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.NEW_MESSAGE,
        title=f"Messaggio da {sender_name}",
        message="Hai ricevuto un nuovo messaggio",
        data={"match_id": match_id}
    )

async def notify_new_event(db: AsyncIOMotorDatabase, user_id: str, event_name: str, event_id: str):
    """Notify user about new event"""
    return await create_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.NEW_EVENT,
        title="Nuovo Evento 🎉",
        message=f"C'è un nuovo evento: {event_name}",
        data={"event_id": event_id}
    )

async def notify_match_liked_you(db: AsyncIOMotorDatabase, user_id: str, liker_name: str):
    """Notify user that someone liked them"""
    return await create_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.MATCH_LIKED_YOU,
        title="Ti hanno messo un Like! ❤️",
        message=f"{liker_name} ti ha messo un like",
        data={}
    )

async def get_unread_count(db: AsyncIOMotorDatabase, user_id: str) -> int:
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({
        "user_id": user_id,
        "read": False
    })
    return count

async def mark_as_read(db: AsyncIOMotorDatabase, notification_id: str, user_id: str) -> bool:
    """Mark notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": user_id},
        {"$set": {"read": True}}
    )
    return result.modified_count > 0

async def mark_all_as_read(db: AsyncIOMotorDatabase, user_id: str) -> int:
    """Mark all notifications as read for user"""
    result = await db.notifications.update_many(
        {"user_id": user_id, "read": False},
        {"$set": {"read": True}}
    )
    return result.modified_count

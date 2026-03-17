import socketio
import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from auth import firebase_auth
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)

CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')
cors_origins = CORS_ORIGINS.split(',') if CORS_ORIGINS != '*' else '*'

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=cors_origins,
    logger=False,
    engineio_logger=False
)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

active_connections = {}

@sio.event
async def connect(sid, environ, auth_data):
    try:
        if not auth_data or 'token' not in auth_data:
            await sio.disconnect(sid)
            return False

        payload = firebase_auth.verify_token(auth_data['token'])
        user_id = payload.get('sub')

        if not user_id:
            await sio.disconnect(sid)
            return False

        active_connections[user_id] = sid
        await sio.save_session(sid, {'user_id': user_id})
        logger.info("Client %s connected as user %s", sid, user_id)
        return True

    except Exception as e:
        logger.warning("Connection error for sid %s: %s", sid, e)
        await sio.disconnect(sid)
        return False

@sio.event
async def disconnect(sid):
    session = await sio.get_session(sid)
    user_id = session.get('user_id') if session else None
    if user_id and user_id in active_connections:
        del active_connections[user_id]
    logger.info("Client %s disconnected", sid)

@sio.event
async def join_match(sid, data):
    try:
        session = await sio.get_session(sid)
        user_id = session.get('user_id')
        match_id = data.get('match_id')

        if not match_id:
            await sio.emit('error', {'message': 'Match ID required'}, room=sid)
            return

        match = await db.matches.find_one({'id': match_id})
        if not match:
            await sio.emit('error', {'message': 'Match not found'}, room=sid)
            return

        if user_id not in [match['user1_id'], match['user2_id']]:
            await sio.emit('error', {'message': 'Unauthorized'}, room=sid)
            return

        await sio.enter_room(sid, match_id)
        await sio.emit('joined_match', {'match_id': match_id}, room=sid)
        logger.info("User %s joined match %s", user_id, match_id)

    except Exception as e:
        logger.error("Error joining match: %s", e)
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def leave_match(sid, data):
    try:
        match_id = data.get('match_id')
        if match_id:
            await sio.leave_room(sid, match_id)
            await sio.emit('left_match', {'match_id': match_id}, room=sid)
    except Exception as e:
        logger.error("Error leaving match: %s", e)

@sio.event
async def send_message(sid, data):
    try:
        session = await sio.get_session(sid)
        user_id = session.get('user_id')

        match_id = data.get('match_id')
        message = data.get('message')
        message_type = data.get('message_type', 'text')

        if not match_id or not message:
            await sio.emit('error', {'message': 'Match ID and message required'}, room=sid)
            return

        message_doc = {
            'id': str(uuid.uuid4()),
            'match_id': match_id,
            'sender_id': user_id,
            'message': message,
            'message_type': message_type,
            'timestamp': datetime.utcnow(),
            'read': False,
            'reactions': []
        }

        await db.messages.insert_one(message_doc)

        match = await db.matches.find_one({'id': match_id})
        if match:
            other_user_id = match['user2_id'] if match['user1_id'] == user_id else match['user1_id']
            sender = await db.users.find_one({'id': user_id})
            sender_name = sender.get('name', 'Qualcuno') if sender else 'Qualcuno'

            from notifications import notify_new_message
            try:
                await notify_new_message(db, other_user_id, sender_name, match_id)
                if other_user_id in active_connections:
                    await sio.emit('new_notification', {
                        'type': 'new_message',
                        'message': f'Messaggio da {sender_name}'
                    }, room=active_connections[other_user_id])
            except Exception as e:
                logger.warning("Error sending notification: %s", e)

        await sio.emit('new_message', {
            'id': message_doc['id'],
            'match_id': match_id,
            'sender_id': user_id,
            'message': message,
            'message_type': message_type,
            'timestamp': message_doc['timestamp'].isoformat(),
            'read': False,
            'reactions': []
        }, room=match_id)

        logger.info("Message sent in match %s by user %s", match_id, user_id)

    except Exception as e:
        logger.error("Error sending message: %s", e)
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def add_reaction(sid, data):
    try:
        session = await sio.get_session(sid)
        user_id = session.get('user_id')

        message_id = data.get('message_id')
        match_id = data.get('match_id')
        reaction = data.get('reaction')

        if not message_id or not reaction:
            await sio.emit('error', {'message': 'Message ID and reaction required'}, room=sid)
            return

        await db.messages.update_one(
            {'id': message_id},
            {'$push': {'reactions': {'user_id': user_id, 'reaction': reaction, 'timestamp': datetime.utcnow()}}}
        )

        await sio.emit('message_reaction', {
            'message_id': message_id,
            'user_id': user_id,
            'reaction': reaction
        }, room=match_id)

        logger.info("Reaction %s added to message %s by user %s", reaction, message_id, user_id)

    except Exception as e:
        logger.error("Error adding reaction: %s", e)
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def typing(sid, data):
    try:
        session = await sio.get_session(sid)
        user_id = session.get('user_id')
        match_id = data.get('match_id')
        is_typing = data.get('is_typing', False)

        if not match_id:
            return

        await sio.emit('user_typing', {
            'user_id': user_id,
            'is_typing': is_typing
        }, room=match_id, skip_sid=sid)

    except Exception as e:
        logger.error("Error broadcasting typing: %s", e)

@sio.event
async def mark_read(sid, data):
    try:
        session = await sio.get_session(sid)
        user_id = session.get('user_id')
        match_id = data.get('match_id')

        if not match_id:
            return

        await db.messages.update_many(
            {'match_id': match_id, 'sender_id': {'$ne': user_id}},
            {'$set': {'read': True}}
        )

        await sio.emit('messages_read', {
            'match_id': match_id,
            'reader_id': user_id
        }, room=match_id, skip_sid=sid)

    except Exception as e:
        logger.error("Error marking read: %s", e)

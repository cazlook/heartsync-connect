import socketio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from auth import firebase_auth
from datetime import datetime
import uuid

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    logger=True,
    engineio_logger=True
)

# Database connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Store active connections: {user_id: sid}
active_connections = {}

@sio.event
async def connect(sid, environ, auth_data):
    """Handle client connection"""
    try:
        # Verify JWT token
        if not auth_data or 'token' not in auth_data:
            await sio.disconnect(sid)
            return False
        
        # Verify token
        payload = firebase_auth.verify_token(auth_data['token'])
        user_id = payload.get('sub')
        
        if not user_id:
            await sio.disconnect(sid)
            return False
        
        # Store connection
        active_connections[user_id] = sid
        
        # Save session
        await sio.save_session(sid, {'user_id': user_id})
        
        print(f"Client {sid} connected as user {user_id}")
        return True
        
    except Exception as e:
        print(f"Connection error: {e}")
        await sio.disconnect(sid)
        return False

@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    
    if user_id and user_id in active_connections:
        del active_connections[user_id]
    
    print(f"Client {sid} disconnected")

@sio.event
async def join_match(sid, data):
    """Join a match room"""
    try:
        session = await sio.get_session(sid)
        user_id = session.get('user_id')
        match_id = data.get('match_id')
        
        if not match_id:
            await sio.emit('error', {'message': 'Match ID required'}, room=sid)
            return
        
        # Verify user is part of the match
        match = await db.matches.find_one({'id': match_id})
        if not match:
            await sio.emit('error', {'message': 'Match not found'}, room=sid)
            return
        
        if user_id not in [match['user1_id'], match['user2_id']]:
            await sio.emit('error', {'message': 'Unauthorized'}, room=sid)
            return
        
        # Join the room
        await sio.enter_room(sid, match_id)
        await sio.emit('joined_match', {'match_id': match_id}, room=sid)
        
        print(f"User {user_id} joined match {match_id}")
        
    except Exception as e:
        print(f"Error joining match: {e}")
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def leave_match(sid, data):
    """Leave a match room"""
    try:
        match_id = data.get('match_id')
        if match_id:
            await sio.leave_room(sid, match_id)
            await sio.emit('left_match', {'match_id': match_id}, room=sid)
    except Exception as e:
        print(f"Error leaving match: {e}")

@sio.event
async def send_message(sid, data):
    """Send a message in a match"""
    try:
        session = await sio.get_session(sid)
        user_id = session.get('user_id')
        
        match_id = data.get('match_id')
        message = data.get('message')
        message_type = data.get('message_type', 'text')
        
        if not match_id or not message:
            await sio.emit('error', {'message': 'Match ID and message required'}, room=sid)
            return
        
        # Create message document
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
        
        # Save to database
        await db.messages.insert_one(message_doc)
        
        # Emit to all users in the match room
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
        
        print(f"Message sent in match {match_id} by user {user_id}")
        
    except Exception as e:
        print(f"Error sending message: {e}")
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def add_reaction(sid, data):
    """Add reaction to a message"""
    try:
        session = await sio.get_session(sid)
        user_id = session.get('user_id')
        
        message_id = data.get('message_id')
        match_id = data.get('match_id')
        reaction = data.get('reaction')  # emoji or 'heart'
        
        if not message_id or not reaction:
            await sio.emit('error', {'message': 'Message ID and reaction required'}, room=sid)
            return
        
        # Update message with reaction
        reaction_obj = {
            'user_id': user_id,
            'reaction': reaction,
            'timestamp': datetime.utcnow()
        }
        
        await db.messages.update_one(
            {'id': message_id},
            {'$push': {'reactions': reaction_obj}}
        )
        
        # Emit to all users in the match room
        await sio.emit('message_reaction', {
            'message_id': message_id,
            'user_id': user_id,
            'reaction': reaction
        }, room=match_id)
        
        print(f"Reaction {reaction} added to message {message_id} by user {user_id}")
        
    except Exception as e:
        print(f"Error adding reaction: {e}")
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def typing(sid, data):
    """Broadcast typing indicator"""
    try:
        session = await sio.get_session(sid)
        user_id = session.get('user_id')
        
        match_id = data.get('match_id')
        is_typing = data.get('is_typing', False)
        
        if not match_id:
            return
        
        # Emit to other users in the match (exclude sender)
        await sio.emit('user_typing', {
            'user_id': user_id,
            'is_typing': is_typing
        }, room=match_id, skip_sid=sid)
        
    except Exception as e:
        print(f"Error broadcasting typing: {e}")

@sio.event
async def mark_read(sid, data):
    """Mark messages as read"""
    try:
        session = await sio.get_session(sid)
        user_id = session.get('user_id')
        
        match_id = data.get('match_id')
        
        if not match_id:
            return
        
        # Mark all messages in match as read
        await db.messages.update_many(
            {'match_id': match_id, 'sender_id': {'$ne': user_id}},
            {'$set': {'read': True}}
        )
        
        # Notify other user
        await sio.emit('messages_read', {
            'match_id': match_id,
            'reader_id': user_id
        }, room=match_id, skip_sid=sid)
        
    except Exception as e:
        print(f"Error marking read: {e}")

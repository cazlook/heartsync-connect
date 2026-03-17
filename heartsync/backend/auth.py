import os
import bcrypt
import jwt
import uuid
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import User, UserCreate, UserLogin, UserResponse

SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24       # 1 day
REFRESH_TOKEN_EXPIRE_DAYS = 30


class MockFirebaseAuth:
    @staticmethod
    async def create_user(email: str, password: str, db: AsyncIOMotorDatabase) -> str:
        existing_user = await db.users.find_one({"email": email})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        return str(uuid.uuid4())

    @staticmethod
    async def verify_password(plain_password: str, hashed_password: str) -> bool:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

    @staticmethod
    def create_access_token(uid: str, email: str) -> tuple[str, str]:
        """Returns (token, jti)"""
        jti = str(uuid.uuid4())
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        payload = {"sub": uid, "email": email, "exp": expire, "jti": jti, "type": "access"}
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        return token, jti

    @staticmethod
    def create_refresh_token(uid: str, email: str) -> tuple[str, str]:
        """Returns (token, jti)"""
        jti = str(uuid.uuid4())
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        payload = {"sub": uid, "email": email, "exp": expire, "jti": jti, "type": "refresh"}
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        return token, jti

    @staticmethod
    def create_custom_token(uid: str, email: str) -> str:
        """Legacy method - kept for socket_server compatibility"""
        token, _ = MockFirebaseAuth.create_access_token(uid, email)
        return token

    @staticmethod
    def verify_token(token: str) -> dict:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )


firebase_auth = MockFirebaseAuth()


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


async def blacklist_token(jti: str, user_id: str, db: AsyncIOMotorDatabase) -> None:
    """Add a token JTI to the blacklist collection."""
    await db.token_blacklist.insert_one({
        "jti": jti,
        "user_id": user_id,
        "blacklisted_at": datetime.utcnow()
    })


async def is_token_blacklisted(jti: str, db: AsyncIOMotorDatabase) -> bool:
    """Check if a token JTI is in the blacklist."""
    doc = await db.token_blacklist.find_one({"jti": jti})
    return doc is not None


def _build_user_response(user: dict) -> UserResponse:
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        age=user.get("age"),
        bio=user.get("bio"),
        city=user.get("city"),
        gender=user.get("gender"),
        seeking=user.get("seeking"),
        interests=user.get("interests", []),
        photos=user.get("photos", []),
        created_at=user["created_at"],
        verified=user.get("verified", False),
        premium=user.get("premium", False),
        role=user.get("role", "user")
    )


async def register_user(user_data: UserCreate, db: AsyncIOMotorDatabase) -> dict:
    uid = await firebase_auth.create_user(user_data.email, user_data.password, db)
    password_hash = hash_password(user_data.password)

    user_dict = {
        "id": uid,
        "email": user_data.email,
        "name": user_data.name,
        "age": user_data.age,
        "bio": user_data.bio,
        "city": user_data.city,
        "gender": getattr(user_data, 'gender', None),
        "seeking": getattr(user_data, 'seeking', None),
        "interests": user_data.interests,
        "photos": user_data.photos,
        "password_hash": password_hash,
        "created_at": datetime.utcnow(),
        "verified": False,
        "premium": False
    }

    await db.users.insert_one(user_dict)

    access_token, _ = firebase_auth.create_access_token(uid, user_data.email)
    refresh_token, refresh_jti = firebase_auth.create_refresh_token(uid, user_data.email)

    await db.refresh_tokens.insert_one({
        "jti": refresh_jti,
        "user_id": uid,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    })

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": _build_user_response(user_dict)
    }


async def login_user(login_data: UserLogin, db: AsyncIOMotorDatabase) -> dict:
    user = await db.users.find_one({"email": login_data.email})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not await firebase_auth.verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    access_token, _ = firebase_auth.create_access_token(user["id"], user["email"])
    refresh_token, refresh_jti = firebase_auth.create_refresh_token(user["id"], user["email"])

    await db.refresh_tokens.insert_one({
        "jti": refresh_jti,
        "user_id": user["id"],
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    })

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": _build_user_response(user)
    }


async def get_current_user(token: str, db: AsyncIOMotorDatabase) -> UserResponse:
    payload = firebase_auth.verify_token(token)
    user_id = payload.get("sub")
    jti = payload.get("jti")

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if jti and await is_token_blacklisted(jti, db):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")

    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return _build_user_response(user)

import os
import bcrypt
import jwt
import uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import User, UserCreate, UserLogin, UserResponse
import logging

logger = logging.getLogger(__name__)

# ===== JWT CONFIGURATION =====
SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY env var not set. Set it before starting the app.")

REFRESH_SECRET_KEY = os.environ.get('JWT_REFRESH_SECRET_KEY')
if not REFRESH_SECRET_KEY:
    raise RuntimeError("JWT_REFRESH_SECRET_KEY env var not set.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 30


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))


def create_access_token(uid: str, email: str):
    jti = str(uuid.uuid4())
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": uid, "email": email, "exp": expire, "iat": datetime.utcnow(), "jti": jti, "type": "access"}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM), jti


def create_refresh_token(uid: str):
    jti = str(uuid.uuid4())
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": uid, "exp": expire, "iat": datetime.utcnow(), "jti": jti, "type": "refresh"}
    return jwt.encode(payload, REFRESH_SECRET_KEY, algorithm=ALGORITHM), jti


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")


def decode_refresh_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")


async def is_token_blacklisted(db: AsyncIOMotorDatabase, jti: str) -> bool:
    return await db.token_blacklist.find_one({"jti": jti}) is not None


async def blacklist_token(db: AsyncIOMotorDatabase, jti: str, user_id: str, expires_at: datetime):
    await db.token_blacklist.insert_one({"id": str(uuid.uuid4()), "jti": jti, "user_id": user_id,
                                         "revoked_at": datetime.utcnow(), "expires_at": expires_at})
    await db.token_blacklist.delete_many({"expires_at": {"$lt": datetime.utcnow()}})
    logger.info(f"Token {jti} blacklisted for user {user_id}")


async def register_user(user_data: UserCreate, db: AsyncIOMotorDatabase) -> UserResponse:
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    uid = str(uuid.uuid4())
    user_dict = {
        "id": uid, "email": user_data.email, "name": user_data.name, "age": user_data.age,
        "bio": user_data.bio, "city": user_data.city, "interests": user_data.interests,
        "photos": user_data.photos, "password_hash": hash_password(user_data.password),
        "created_at": datetime.utcnow(), "verified": False, "premium": False
    }
    await db.users.insert_one(user_dict)
    logger.info(f"New user registered: {uid}")
    return UserResponse(id=uid, email=user_data.email, name=user_data.name, age=user_data.age,
                        bio=user_data.bio, city=user_data.city, interests=user_data.interests,
                        photos=user_data.photos, created_at=user_dict["created_at"], verified=False, premium=False)


async def login_user(login_data: UserLogin, db: AsyncIOMotorDatabase) -> dict:
    user = await db.users.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    access_token, _ = create_access_token(user["id"], user["email"])
    refresh_token, refresh_jti = create_refresh_token(user["id"])
    await db.refresh_tokens.insert_one({"jti": refresh_jti, "user_id": user["id"],
                                         "created_at": datetime.utcnow(),
                                         "expires_at": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)})
    logger.info(f"User logged in: {user['id']}")
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer",
            "user": UserResponse(id=user["id"], email=user["email"], name=user["name"],
                                  age=user.get("age"), bio=user.get("bio"), city=user.get("city"),
                                  interests=user.get("interests", []), photos=user.get("photos", []),
                                  created_at=user["created_at"], verified=user.get("verified", False),
                                  premium=user.get("premium", False))}


async def refresh_access_token(refresh_token_str: str, db: AsyncIOMotorDatabase) -> dict:
    payload = decode_refresh_token(refresh_token_str)
    jti = payload.get("jti")
    user_id = payload.get("sub")
    stored = await db.refresh_tokens.find_one({"jti": jti, "user_id": user_id})
    if not stored:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token not valid or already used")
    if await is_token_blacklisted(db, jti):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")
    await db.refresh_tokens.delete_one({"jti": jti})
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    new_access, _ = create_access_token(user["id"], user["email"])
    new_refresh, new_jti = create_refresh_token(user["id"])
    await db.refresh_tokens.insert_one({"jti": new_jti, "user_id": user["id"],
                                         "created_at": datetime.utcnow(),
                                         "expires_at": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)})
    logger.info(f"Token refreshed for user {user_id}")
    return {"access_token": new_access, "refresh_token": new_refresh, "token_type": "bearer"}


async def logout_user(access_token: str, refresh_token: Optional[str], db: AsyncIOMotorDatabase):
    try:
        payload = decode_access_token(access_token)
        await blacklist_token(db, payload["jti"], payload["sub"], datetime.fromtimestamp(payload["exp"]))
    except HTTPException:
        pass
    if refresh_token:
        try:
            r = decode_refresh_token(refresh_token)
            await db.refresh_tokens.delete_one({"jti": r["jti"]})
        except HTTPException:
            pass


async def get_current_user(token: str, db: AsyncIOMotorDatabase) -> UserResponse:
    payload = decode_access_token(token)
    jti = payload.get("jti")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if await is_token_blacklisted(db, jti):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse(id=user["id"], email=user["email"], name=user["name"], age=user.get("age"),
                        bio=user.get("bio"), city=user.get("city"), interests=user.get("interests", []),
                        photos=user.get("photos", []), created_at=user["created_at"],
                        verified=user.get("verified", False), premium=user.get("premium", False))

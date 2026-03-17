import os
import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import User, UserCreate, UserLogin, UserResponse
import uuid

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Mock Firebase Auth for development (without real Firebase keys)
class MockFirebaseAuth:
    """Mock Firebase Auth for development without real credentials"""
    
    @staticmethod
    async def create_user(email: str, password: str, db: AsyncIOMotorDatabase) -> str:
        """Create a new user (mock Firebase createUser)"""
        # Check if user exists
        existing_user = await db.users.find_one({"email": email})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        return str(uuid.uuid4())
    
    @staticmethod
    async def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify password"""
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    
    @staticmethod
    def create_custom_token(uid: str, email: str) -> str:
        """Create JWT token (mock Firebase custom token)"""
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode = {
            "sub": uid,
            "email": email,
            "exp": expire
        }
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def verify_token(token: str) -> dict:
        """Verify JWT token"""
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
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

async def register_user(user_data: UserCreate, db: AsyncIOMotorDatabase) -> UserResponse:
    """Register a new user"""
    # Create user with mock Firebase
    uid = await firebase_auth.create_user(user_data.email, user_data.password, db)
    
    # Hash password
    password_hash = hash_password(user_data.password)
    
    # Create user document
    user_dict = {
        "id": uid,
        "email": user_data.email,
        "name": user_data.name,
        "age": user_data.age,
        "bio": user_data.bio,
        "city": user_data.city,
        "interests": user_data.interests,
        "photos": user_data.photos,
        "password_hash": password_hash,
        "created_at": datetime.utcnow(),
        "verified": False,
        "premium": False
    }
    
    await db.users.insert_one(user_dict)
    
    return UserResponse(
        id=uid,
        email=user_data.email,
        name=user_data.name,
        age=user_data.age,
        bio=user_data.bio,
        city=user_data.city,
        interests=user_data.interests,
        photos=user_data.photos,
        created_at=user_dict["created_at"],
        verified=False,
        premium=False
    )

async def login_user(login_data: UserLogin, db: AsyncIOMotorDatabase) -> dict:
    """Login user and return token"""
    # Find user
    user = await db.users.find_one({"email": login_data.email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Verify password
    if not await firebase_auth.verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Create token
    token = firebase_auth.create_custom_token(user["id"], user["email"])
    
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        age=user.get("age"),
        bio=user.get("bio"),
        city=user.get("city"),
        interests=user.get("interests", []),
        photos=user.get("photos", []),
        created_at=user["created_at"],
        verified=user.get("verified", False),
        premium=user.get("premium", False)
    )
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_response
    }

async def get_current_user(token: str, db: AsyncIOMotorDatabase) -> UserResponse:
    """Get current user from token"""
    payload = firebase_auth.verify_token(token)
    user_id = payload.get("sub")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        age=user.get("age"),
        bio=user.get("bio"),
        city=user.get("city"),
        interests=user.get("interests", []),
        photos=user.get("photos", []),
        created_at=user["created_at"],
        verified=user.get("verified", False),
        premium=user.get("premium", False)
    )

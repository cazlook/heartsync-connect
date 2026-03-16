from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorDatabase
from auth import get_current_user
from models import UserResponse
import os
from motor.motor_asyncio import AsyncIOMotorClient

security = HTTPBearer()

# Database dependency
async def get_db() -> AsyncIOMotorDatabase:
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    return db

async def get_current_user_dependency(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> UserResponse:
    """
    Dependency to get current authenticated user.
    Use this in protected routes.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    try:
        user = await get_current_user(credentials.credentials, db)
        return user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )

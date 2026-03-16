from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime
from models import UserCreate, UserLogin, TokenResponse, UserResponse, UserUpdate
from auth import register_user, login_user
from dependencies import get_current_user_dependency, get_db


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# ===== AUTHENTICATION ROUTES =====
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate, database = Depends(get_db)):
    """Register a new user"""
    user = await register_user(user_data, database)
    # Auto-login after registration
    from models import UserLogin
    login_data = UserLogin(email=user_data.email, password=user_data.password)
    return await login_user(login_data, database)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(login_data: UserLogin, database = Depends(get_db)):
    """Login user"""
    return await login_user(login_data, database)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_user_dependency)):
    """Get current user profile"""
    return current_user

@api_router.put("/auth/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UserUpdate,
    current_user: UserResponse = Depends(get_current_user_dependency),
    database = Depends(get_db)
):
    """Update user profile"""
    # Update only provided fields
    update_dict = {k: v for k, v in profile_data.dict().items() if v is not None}
    
    if update_dict:
        await database.users.update_one(
            {"id": current_user.id},
            {"$set": update_dict}
        )
    
    # Return updated user
    updated_user = await database.users.find_one({"id": current_user.id})
    return UserResponse(**updated_user)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

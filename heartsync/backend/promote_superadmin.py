"""
Script per promuovere un utente a superadmin su MongoDB.
Uso: python promote_superadmin.py <email>
"""
import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env')

async def promote(email: str):
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "SyncLove")
    if not mongo_url:
        print("ERROR: MONGO_URL not set in .env")
        sys.exit(1)

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    user = await db.users.find_one({"email": email})
    if not user:
        print(f"ERROR: No user found with email '{email}'")
        client.close()
        sys.exit(1)

    await db.users.update_one(
        {"email": email},
        {"$set": {"role": "superadmin", "verified": True, "premium": True}}
    )

    print(f"SUCCESS: '{user['name']}' ({email}) is now superadmin + verified + premium")
    print(f"User ID: {user['id']}")
    client.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python promote_superadmin.py <email>")
        sys.exit(1)
    asyncio.run(promote(sys.argv[1]))

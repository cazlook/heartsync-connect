from datetime import datetime, timedelta
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import BiometricStats, TopReaction
import uuid

async def calculate_stats(db: AsyncIOMotorDatabase, user_id: str) -> BiometricStats:
    """Calculate biometric statistics for user"""
    # Get heart rate readings
    readings = await db.heart_rate_readings.find({"user_id": user_id}).to_list(None)
    reactions = await db.emotional_reactions.find({"user_id": user_id}).to_list(None)
    
    if not readings:
        return BiometricStats(
            total_readings=0,
            avg_bpm=0,
            max_bpm=0,
            min_bpm=0,
            total_reactions=0,
            avg_reaction_intensity=0,
            most_reactive_time=None
        )
    
    bpms = [r["bpm"] for r in readings]
    avg_bpm = sum(bpms) / len(bpms)
    max_bpm = max(bpms)
    min_bpm = min(bpms)
    
    # Calculate average reaction intensity
    intensity_map = {"low": 1, "medium": 2, "high": 3}
    if reactions:
        avg_intensity = sum(intensity_map.get(r["intensity"], 1) for r in reactions) / len(reactions)
    else:
        avg_intensity = 0
    
    # Find most reactive time (hour of day)
    most_reactive_time = None
    if reactions:
        hour_counts = {}
        for r in reactions:
            hour = r["timestamp"].hour
            hour_counts[hour] = hour_counts.get(hour, 0) + 1
        most_reactive_hour = max(hour_counts.items(), key=lambda x: x[1])[0]
        most_reactive_time = f"{most_reactive_hour}:00"
    
    return BiometricStats(
        total_readings=len(readings),
        avg_bpm=round(avg_bpm, 1),
        max_bpm=max_bpm,
        min_bpm=min_bpm,
        total_reactions=len(reactions),
        avg_reaction_intensity=round(avg_intensity, 2),
        most_reactive_time=most_reactive_time
    )

async def get_top_reactions(
    db: AsyncIOMotorDatabase, 
    user_id: str, 
    limit: int = 10
) -> List[TopReaction]:
    """Get top profiles that caused the strongest reactions"""
    # Aggregate reactions by profile_id
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$sort": {"bpm_delta": -1}},
        {"$group": {
            "_id": "$profile_id",
            "profile_name": {"$first": "$profile_name"},
            "max_bpm_delta": {"$max": "$bpm_delta"},
            "avg_bpm_delta": {"$avg": "$bpm_delta"},
            "intensity": {"$first": "$intensity"},
            "last_timestamp": {"$max": "$timestamp"},
            "reaction_count": {"$sum": 1}
        }},
        {"$sort": {"max_bpm_delta": -1}},
        {"$limit": limit}
    ]
    
    results = await db.emotional_reactions.aggregate(pipeline).to_list(limit)
    
    top_reactions = []
    for r in results:
        top_reactions.append(TopReaction(
            profile_id=r["_id"],
            profile_name=r["profile_name"],
            bpm_delta=r["max_bpm_delta"],
            intensity=r["intensity"],
            timestamp=r["last_timestamp"],
            reaction_count=r["reaction_count"]
        ))
    
    return top_reactions

async def get_bpm_timeline(
    db: AsyncIOMotorDatabase,
    user_id: str,
    days: int = 7
) -> List[dict]:
    """Get BPM timeline for the last N days"""
    since = datetime.utcnow() - timedelta(days=days)
    
    readings = await db.heart_rate_readings.find({
        "user_id": user_id,
        "timestamp": {"$gte": since}
    }).sort("timestamp", 1).to_list(1000)
    
    timeline = []
    for r in readings:
        timeline.append({
            "timestamp": r["timestamp"].isoformat(),
            "bpm": r["bpm"],
            "context": r.get("context", "browsing")
        })
    
    return timeline

async def get_reactions_history(
    db: AsyncIOMotorDatabase,
    user_id: str,
    days: int = 30
) -> List[dict]:
    """Get reaction history for the last N days"""
    since = datetime.utcnow() - timedelta(days=days)
    
    reactions = await db.emotional_reactions.find({
        "user_id": user_id,
        "timestamp": {"$gte": since}
    }).sort("timestamp", -1).to_list(100)
    
    history = []
    for r in reactions:
        history.append({
            "id": r["id"],
            "profile_id": r["profile_id"],
            "profile_name": r["profile_name"],
            "bpm_before": r["bpm_before"],
            "bpm_peak": r["bpm_peak"],
            "bpm_delta": r["bpm_delta"],
            "intensity": r["intensity"],
            "timestamp": r["timestamp"].isoformat()
        })
    
    return history

async def get_weekly_summary(
    db: AsyncIOMotorDatabase,
    user_id: str
) -> dict:
    """Get weekly summary of biometric data"""
    week_ago = datetime.utcnow() - timedelta(days=7)
    
    # Readings this week
    readings = await db.heart_rate_readings.find({
        "user_id": user_id,
        "timestamp": {"$gte": week_ago}
    }).to_list(None)
    
    # Reactions this week
    reactions = await db.emotional_reactions.find({
        "user_id": user_id,
        "timestamp": {"$gte": week_ago}
    }).to_list(None)
    
    # Group by day
    daily_stats = {}
    for r in readings:
        day = r["timestamp"].date().isoformat()
        if day not in daily_stats:
            daily_stats[day] = {"readings": 0, "total_bpm": 0, "reactions": 0}
        daily_stats[day]["readings"] += 1
        daily_stats[day]["total_bpm"] += r["bpm"]
    
    for r in reactions:
        day = r["timestamp"].date().isoformat()
        if day in daily_stats:
            daily_stats[day]["reactions"] += 1
    
    # Calculate averages
    for day in daily_stats:
        if daily_stats[day]["readings"] > 0:
            daily_stats[day]["avg_bpm"] = round(
                daily_stats[day]["total_bpm"] / daily_stats[day]["readings"], 1
            )
        else:
            daily_stats[day]["avg_bpm"] = 0
    
    return {
        "period": "last_7_days",
        "total_readings": len(readings),
        "total_reactions": len(reactions),
        "daily_breakdown": daily_stats
    }

from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import datetime, timedelta
import logging
import math

logger = logging.getLogger(__name__)

# ===== CARDIAC MATCHING ALGORITHM =====
# Il cardiac_score si basa su:
# 1. BPM delta medio (quanto il cuore dell'utente reagisce ai profili dell'altro)
# 2. Intensita' media delle reazioni emotive
# 3. Reciprocita' (entrambi reagiscono l'uno all'altro)
#
# Formula: score = (normalized_delta * 0.4) + (normalized_intensity * 0.4) + (reciprocity * 0.2)
# Risultato: 0-100, dove 100 = compatibilita' massima

INTENSITY_MAP = {"low": 0.33, "medium": 0.66, "high": 1.0}

COMPATIBILITY_LEVELS = [
    (80, "exceptional"),
    (60, "high"),
    (40, "medium"),
    (0, "low"),
]

MIN_REACTIONS_FOR_MATCH = 2  # Minimo reazioni necessarie per calcolare un match


def _normalize_bpm_delta(bpm_delta: float, max_delta: float = 40.0) -> float:
    """Normalizza il delta BPM in un range 0-1.
    Un delta alto indica forte reazione cardiaca."""
    return min(abs(bpm_delta) / max_delta, 1.0)


def _get_compatibility_level(score: float) -> str:
    for threshold, level in COMPATIBILITY_LEVELS:
        if score >= threshold:
            return level
    return "low"


async def calculate_cardiac_score(
    db: AsyncIOMotorDatabase,
    user1_id: str,
    user2_id: str,
    lookback_days: int = 30
) -> Optional[dict]:
    """
    Calcola il cardiac_score tra due utenti basandosi sulle reazioni emotive reciproche.
    Ritorna un dict con score e dettagli, oppure None se non ci sono abbastanza dati.
    """
    since = datetime.utcnow() - timedelta(days=lookback_days)

    # Reazioni di user1 verso user2
    reactions_1_to_2 = await db.emotional_reactions.find({
        "user_id": user1_id,
        "profile_id": user2_id,
        "timestamp": {"$gt": since}
    }).to_list(100)

    # Reazioni di user2 verso user1
    reactions_2_to_1 = await db.emotional_reactions.find({
        "user_id": user2_id,
        "profile_id": user1_id,
        "timestamp": {"$gt": since}
    }).to_list(100)

    total_reactions = len(reactions_1_to_2) + len(reactions_2_to_1)
    if total_reactions < MIN_REACTIONS_FOR_MATCH:
        logger.debug(f"Not enough reactions between {user1_id} and {user2_id}: {total_reactions}")
        return None

    # Calcola medie
    all_reactions = reactions_1_to_2 + reactions_2_to_1
    avg_delta = sum(r["bpm_delta"] for r in all_reactions) / len(all_reactions)
    avg_intensity = sum(INTENSITY_MAP.get(r["intensity"], 0.5) for r in all_reactions) / len(all_reactions)

    # Reciprocita': entrambi hanno reagito?
    reciprocity = 1.0 if (reactions_1_to_2 and reactions_2_to_1) else 0.3

    # Score finale (0-100)
    norm_delta = _normalize_bpm_delta(avg_delta)
    score = round((norm_delta * 40) + (avg_intensity * 40) + (reciprocity * 20), 2)
    level = _get_compatibility_level(score)

    return {
        "cardiac_score": score,
        "bpm_delta_avg": round(avg_delta, 2),
        "reaction_intensity_avg": round(avg_intensity, 3),
        "reciprocity": reciprocity,
        "compatibility_level": level,
        "total_reactions": total_reactions
    }


async def find_potential_matches(
    db: AsyncIOMotorDatabase,
    user_id: str,
    limit: int = 20,
    min_score: float = 30.0
) -> list:
    """
    Trova tutti i potenziali match per un utente basandosi sulle reazioni emotive.
    Ordina per cardiac_score decrescente.
    """
    # Trova tutti gli utenti con cui l'utente ha avuto reazioni
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$profile_id"}},
        {"$limit": 100}
    ]
    profiles = await db.emotional_reactions.aggregate(pipeline).to_list(100)
    profile_ids = [p["_id"] for p in profiles]

    if not profile_ids:
        return []

    results = []
    for profile_id in profile_ids:
        # Salta se match gia' esistente
        existing = await db.matches.find_one({
            "$or": [
                {"user1_id": user_id, "user2_id": profile_id},
                {"user1_id": profile_id, "user2_id": user_id}
            ]
        })
        if existing:
            continue

        score_data = await calculate_cardiac_score(db, user_id, profile_id)
        if score_data and score_data["cardiac_score"] >= min_score:
            results.append({"user_id": profile_id, **score_data})

    # Ordina per score decrescente
    results.sort(key=lambda x: x["cardiac_score"], reverse=True)
    return results[:limit]


async def create_match_if_compatible(
    db: AsyncIOMotorDatabase,
    user1_id: str,
    user2_id: str,
    min_score: float = 40.0
) -> Optional[dict]:
    """
    Calcola il cardiac_score e crea un match se supera la soglia minima.
    Ritorna il match creato o None.
    """
    import uuid
    score_data = await calculate_cardiac_score(db, user1_id, user2_id)
    if not score_data or score_data["cardiac_score"] < min_score:
        return None

    existing = await db.matches.find_one({
        "$or": [
            {"user1_id": user1_id, "user2_id": user2_id},
            {"user1_id": user2_id, "user2_id": user1_id}
        ]
    })
    if existing:
        return None

    match_doc = {
        "id": str(uuid.uuid4()),
        "user1_id": user1_id,
        "user2_id": user2_id,
        "cardiac_score": score_data["cardiac_score"],
        "bpm_delta_avg": score_data["bpm_delta_avg"],
        "reaction_intensity_avg": score_data["reaction_intensity_avg"],
        "matched_at": datetime.utcnow()
    }
    await db.matches.insert_one(match_doc)
    logger.info(f"New match created: {user1_id} <-> {user2_id}, score={score_data['cardiac_score']}")
    return match_doc

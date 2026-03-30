"""cardiac_engine.py - FlashLove/HeartSync Cardiac Matching Engine

FASE 1: Welford Online Algorithm - baseline dinamica
FASE 2: Z-Score computation
FASE 3: Validazione finestra segnali (processWindow)
FASE 4: Confidence score
FASE 5-6: Matching automatico A<->B + cardiac_score
"""
from datetime import datetime, timedelta
from typing import Deque, List, Tuple, Optional
from collections import deque
import logging
import uuid

logger = logging.getLogger(__name__)

# ========== FASE 1: WELFORD ONLINE ALGORITHM ==========

class WelfordBaseline:
    """Aggiorna baseline dinamica con Welford Online Algorithm."""

    def __init__(self):
        self.count = 0
        self.mean = 70.0  # default
        self.M2 = 0.0     # sum of squares of deviations

    def update(self, bpm: float) -> Tuple[float, float]:
        """Aggiorna baseline con nuovo BPM. Ignora BPM >= 120."""
        if bpm >= 120:
            return self.mean, self.get_std()
        self.count += 1
        delta = bpm - self.mean
        self.mean += delta / self.count
        delta2 = bpm - self.mean
        self.M2 += delta * delta2
        return self.mean, self.get_std()

    def get_std(self) -> float:
        if self.count < 2:
            return 5.0
        variance = self.M2 / (self.count - 1)
        return max(variance ** 0.5, 1.0)

    def is_calibrated(self) -> bool:
        return self.count >= 10


# ========== FASE 2: Z-SCORE ==========

def compute_z_score(bpm: float, baseline_mean: float, baseline_std: float) -> float:
    """z = (BPM - mean) / max(std, 3)"""
    denom = max(baseline_std, 3.0)
    return (bpm - baseline_mean) / denom


# ========== FASE 3: SIGNAL WINDOW ==========

class SignalWindow:
    """Buffer finestra scorrevole di eventi BPM."""

    def __init__(self, window_seconds: float = 10.0):
        self.window_seconds = window_seconds
        self.buffer: Deque[Tuple[datetime, float, float]] = deque()

    def add_point(self, ts: datetime, bpm: float, z: float) -> None:
        self.buffer.append((ts, bpm, z))
        while self.buffer and (ts - self.buffer[0][0]).total_seconds() > self.window_seconds:
            self.buffer.popleft()

    def process_window(
        self,
        z_threshold: float = 1.5,
        min_duration: float = 2.5,
        max_variance: float = 4.0
    ) -> Optional[dict]:
        if not self.buffer:
            return None
        above = [(ts, bpm, z) for ts, bpm, z in self.buffer if z >= z_threshold]
        if len(above) < 2:
            return None
        duration = (above[-1][0] - above[0][0]).total_seconds()
        if duration < min_duration:
            return None
        z_scores = [z for _, _, z in above]
        mean_z = sum(z_scores) / len(z_scores)
        variance_z = sum((z - mean_z) ** 2 for z in z_scores) / len(z_scores)
        if variance_z > max_variance:
            return None
        stability = 1.0 - min(variance_z / max_variance, 1.0)
        return {
            "avg_z": mean_z,
            "duration": duration,
            "valid_signals_count": len(above),
            "stability": stability,
            "variance_z": variance_z
        }


# ========== FASE 4: CONFIDENCE SCORE ==========

def compute_confidence(duration: float, stability: float, num_signals: int) -> float:
    """confidence = (dur/10 * 0.40) + (stability * 0.35) + (signals/4 * 0.25)"""
    dur_factor = min(duration / 10.0, 1.0)
    sig_factor = min(num_signals / 4.0, 1.0)
    confidence = (dur_factor * 0.40) + (stability * 0.35) + (sig_factor * 0.25)
    return max(0.0, min(1.0, confidence))


# ========== FASE 5-6: MATCHING ENGINE ==========

def cardiac_score_from_z(avg_z_A: float, avg_z_B: float) -> float:
    avg_z = (avg_z_A + avg_z_B) / 2.0
    z_clamped = max(0.0, min(avg_z, 3.0))
    return round((z_clamped / 3.0) * 100.0, 1)


async def attempt_cardiac_match(
    db,
    viewer_id: str,
    target_id: str,
    match_window_minutes: int = 10
) -> Optional[dict]:
    """Crea match cardiaco se A->B e B->A validi entro la finestra."""
    threshold_time = datetime.utcnow() - timedelta(minutes=match_window_minutes)
    reaction_A = await db.cardiac_reactions.find_one(
        {"viewer_id": viewer_id, "target_id": target_id,
         "confidence": {"$gte": 0.4}, "created_at": {"$gte": threshold_time}},
        sort=[("created_at", -1)]
    )
    reaction_B = await db.cardiac_reactions.find_one(
        {"viewer_id": target_id, "target_id": viewer_id,
         "confidence": {"$gte": 0.4}, "created_at": {"$gte": threshold_time}},
        sort=[("created_at", -1)]
    )
    if not reaction_A or not reaction_B:
        return None
    existing = await db.cardiac_matches.find_one({"$or": [
        {"user1_id": viewer_id, "user2_id": target_id},
        {"user1_id": target_id, "user2_id": viewer_id}
    ]})
    if existing:
        return existing
    score = cardiac_score_from_z(reaction_A["avg_z"], reaction_B["avg_z"])
    match_doc = {
        "id": str(uuid.uuid4()),
        "user1_id": min(viewer_id, target_id),
        "user2_id": max(viewer_id, target_id),
        "cardiac_score": score,
        "reaction_A_to_B_id": reaction_A["id"],
        "reaction_B_to_A_id": reaction_B["id"],
        "avg_z_A_to_B": reaction_A["avg_z"],
        "avg_z_B_to_A": reaction_B["avg_z"],
        "confidence_A_to_B": reaction_A["confidence"],
        "confidence_B_to_A": reaction_B["confidence"],
        "created_at": datetime.utcnow()
    }
    await db.cardiac_matches.insert_one(match_doc)
    logger.info(f"CARDIAC MATCH: {viewer_id}<->{target_id} score={score}")
    return match_doc


# ========== SIMULATOR ==========

def generate_scenario_bpm(
    pattern: str,
    baseline_mean: float = 70.0,
    duration_s: int = 20
) -> List[Tuple[datetime, float]]:
    import random
    now = datetime.utcnow()
    seq = []
    for i in range(duration_s):
        if pattern == "high" and 5 <= i < 10:
            bpm = baseline_mean + random.uniform(20, 30)
        elif pattern == "medium" and 5 <= i < 8:
            bpm = baseline_mean + random.uniform(8, 10)
        elif pattern == "noise":
            bpm = baseline_mean + random.uniform(-10, 15)
        elif pattern == "spike" and i == 10:
            bpm = baseline_mean + 30
        else:
            bpm = baseline_mean + random.uniform(-2, 2)
        seq.append((now + timedelta(seconds=i), bpm))
    return seq

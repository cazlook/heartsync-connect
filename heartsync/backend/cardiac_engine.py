"""cardiac_engine.py — FlashLove/HeartSync Cardiac Matching Engine

Implementa l'algoritmo completo descritto nella roadmap:
- FASE 1: Welford Online Algorithm per baseline dinamica
- FASE 2: Z-Score computation
- FASE 3: Validazione finestra segnali (processWindow)
- FASE 4: Confidence score
- FASE 5-6: Matching automatico A↔B + cardiac_score
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
        """Aggiorna baseline con nuovo BPM.
        
        Returns:
            (mean, std)
        """
        if bpm >= 120:
            # Ignora BPM >= 120 (movimento fisico, non emozione)
            return self.mean, self.get_std()
        
        self.count += 1
        delta = bpm - self.mean
        self.mean += delta / self.count
        delta2 = bpm - self.mean
        self.M2 += delta * delta2
        
        return self.mean, self.get_std()
    
    def get_std(self) -> float:
        """Calcola deviazione standard corrente."""
        if self.count < 2:
            return 5.0  # default per primi campioni
        variance = self.M2 / (self.count - 1)
        return max(variance ** 0.5, 1.0)
    
    def is_calibrated(self) -> bool:
        """Utente calibrato dopo 10 campioni a riposo."""
        return self.count >= 10


# ========== FASE 2: Z-SCORE COMPUTATION ==========

def compute_z_score(bpm: float, baseline_mean: float, baseline_std: float) -> float:
    """Calcola z-score: z = (BPM - mean) / max(std, 3).
    
    Il min std = 3 evita divisioni instabili.
    """
    denom = max(baseline_std, 3.0)
    return (bpm - baseline_mean) / denom


# ========== FASE 3: VALIDAZIONE FINESTRA (processWindow) ==========

class SignalWindow:
    """Buffer finestra scorrevole di eventi BPM."""
    
    def __init__(self, window_seconds: float = 10.0):
        self.window_seconds = window_seconds
        self.buffer: Deque[Tuple[datetime, float, float]] = deque()  # (timestamp, bpm, z)
    
    def add_point(self, ts: datetime, bpm: float, z: float) -> None:
        """Aggiungi punto e mantieni solo ultimi N secondi."""
        self.buffer.append((ts, bpm, z))
        # Rimuovi punti vecchi
        while self.buffer and (ts - self.buffer[0][0]).total_seconds() > self.window_seconds:
            self.buffer.popleft()
    
    def process_window(self, z_threshold: float = 1.5, min_duration: float = 2.5, max_variance: float = 4.0) -> Optional[dict]:
        """Valida finestra secondo i criteri Fase 3.
        
        Criteri:
        - Segnali validi minimi: ≥ 2 eventi con z ≥ threshold
        - Durata minima: ≥ 2.5 secondi
        - Varianza massima tra z-score: ≤ 4 (segnale stabile)
        
        Returns:
            dict con avg_z, duration, valid_signals_count, stability se VALID_REACTION
            None se non passa i controlli
        """
        if not self.buffer:
            return None
        
        # Filtra eventi con z >= threshold
        above_threshold = [(ts, bpm, z) for ts, bpm, z in self.buffer if z >= z_threshold]
        
        if len(above_threshold) < 2:
            # Controllo 1: almeno 2 segnali validi
            return None
        
        # Controllo 2: durata minima
        duration = (above_threshold[-1][0] - above_threshold[0][0]).total_seconds()
        if duration < min_duration:
            return None
        
        # Controllo 3: varianza z-score (stabilità)
        z_scores = [z for _, _, z in above_threshold]
        if len(z_scores) < 2:
            return None
        
        mean_z = sum(z_scores) / len(z_scores)
        variance_z = sum((z - mean_z) ** 2 for z in z_scores) / len(z_scores)
        
        if variance_z > max_variance:
            return None
        
        # VALID_REACTION
        stability_score = 1.0 - min(variance_z / max_variance, 1.0)  # 0-1
        
        return {
            "avg_z": mean_z,
            "duration": duration,
            "valid_signals_count": len(above_threshold),
            "stability": stability_score,
            "variance_z": variance_z
        }


# ========== FASE 4: CONFIDENCE SCORE ==========

def compute_confidence(duration: float, stability: float, num_signals: int) -> float:
    """Calcola confidence score (0.0 - 1.0).
    
    Formula: (durata/10 × 0.40) + (stabilità × 0.35) + (conteggio_segnali/4 × 0.25)
    
    Soglia minima per matching: confidence >= 0.4
    """
    dur_factor = min(duration / 10.0, 1.0)  # satura a 10 secondi
    sig_factor = min(num_signals / 4.0, 1.0)  # satura a 4 segnali
    
    confidence = (dur_factor * 0.40) + (stability * 0.35) + (sig_factor * 0.25)
    return max(0.0, min(1.0, confidence))


# ========== FASE 5-6: MATCHING ENGINE + CARDIAC SCORE ==========

def cardiac_score_from_z(avg_z_A_to_B: float, avg_z_B_to_A: float) -> float:
    """Calcola cardiac_score (0-100) dalla media degli z-score.
    
    Formula: ((z_A→B + z_B→A) / 2) / 3.0 × 100
    z = 0 → score = 0
    z = 3.0 → score = 100 (valore massimo considerato)
    """
    avg_z = (avg_z_A_to_B + avg_z_B_to_A) / 2.0
    # Clamp z a [0, 3.0]
    z_clamped = max(0.0, min(avg_z, 3.0))
    return round((z_clamped / 3.0) * 100.0, 1)


async def attempt_cardiac_match(db, viewer_id: str, target_id: str, match_window_minutes: int = 10) -> Optional[dict]:
    """Prova a creare match cardiaco se A→B e B→A entrambi validi.
    
    Condizioni:
    - A → B: reazione valida (confidence >= 0.4)
    - B → A: reazione valida (confidence >= 0.4)
    - Entrambe negli ultimi match_window_minutes
    
    Returns:
        dict del match creato, o None se condizioni non soddisfatte
    """
    threshold_time = datetime.utcnow() - timedelta(minutes=match_window_minutes)
    
    # Cerca reazione A → B
    reaction_A_to_B = await db.cardiac_reactions.find_one({
        "viewer_id": viewer_id,
        "target_id": target_id,
        "confidence": {"$gte": 0.4},
        "created_at": {"$gte": threshold_time}
    }, sort=[("created_at", -1)])
    
    # Cerca reazione B → A
    reaction_B_to_A = await db.cardiac_reactions.find_one({
        "viewer_id": target_id,
        "target_id": viewer_id,
        "confidence": {"$gte": 0.4},
        "created_at": {"$gte": threshold_time}
    }, sort=[("created_at", -1)])
    
    if not reaction_A_to_B or not reaction_B_to_A:
        return None
    
    # Verifica se il match esiste già
    existing = await db.cardiac_matches.find_one({
        "$or": [
            {"user1_id": viewer_id, "user2_id": target_id},
            {"user1_id": target_id, "user2_id": viewer_id}
        ]
    })
    
    if existing:
        logger.info(f"Cardiac match già esistente tra {viewer_id} e {target_id}")
        return existing
    
    # Calcola cardiac_score
    score = cardiac_score_from_z(
        reaction_A_to_B["avg_z"],
        reaction_B_to_A["avg_z"]
    )
    
    # Crea match
    match_doc = {
        "id": str(uuid.uuid4()),
        "user1_id": min(viewer_id, target_id),  # ordine canonico
        "user2_id": max(viewer_id, target_id),
        "cardiac_score": score,
        "reaction_A_to_B_id": reaction_A_to_B["id"],
        "reaction_B_to_A_id": reaction_B_to_A["id"],
        "avg_z_A_to_B": reaction_A_to_B["avg_z"],
        "avg_z_B_to_A": reaction_B_to_A["avg_z"],
        "confidence_A_to_B": reaction_A_to_B["confidence"],
        "confidence_B_to_A": reaction_B_to_A["confidence"],
        "created_at": datetime.utcnow()
    }
    
    await db.cardiac_matches.insert_one(match_doc)
    
    logger.info(
        f"💕 CARDIAC MATCH creato: {viewer_id}↔{target_id}, "
        f"score={score}, z_avg={(reaction_A_to_B['avg_z'] + reaction_B_to_A['avg_z'])/2:.2f}"
    )
    
    return match_doc


# ========== SCENARIO SIMULATOR (per debug/test) ==========

def generate_scenario_bpm(pattern: str, baseline_mean: float = 70.0, duration_s: int = 20) -> List[Tuple[datetime, float]]:
    """Genera sequenze BPM per scenari di test.
    
    Patterns:
    - "none": baseline stabile
    - "medium": +8-10 bpm per 3s
    - "high": +20-30 bpm per 5s
    - "noise": oscillazioni casuali
    - "spike": picco singolo 1-2s
    """
    import random
    
    now = datetime.utcnow()
    sequence = []
    
    if pattern == "none":
        for i in range(duration_s):
            bpm = baseline_mean + random.uniform(-2, 2)
            sequence.append((now + timedelta(seconds=i), bpm))
    
    elif pattern == "medium":
        for i in range(duration_s):
            if 5 <= i < 8:  # 3 secondi di reazione media
                bpm = baseline_mean + random.uniform(8, 10)
            else:
                bpm = baseline_mean + random.uniform(-2, 2)
            sequence.append((now + timedelta(seconds=i), bpm))
    
    elif pattern == "high":
        for i in range(duration_s):
            if 5 <= i < 10:  # 5 secondi di reazione alta
                bpm = baseline_mean + random.uniform(20, 30)
            else:
                bpm = baseline_mean + random.uniform(-2, 2)
            sequence.append((now + timedelta(seconds=i), bpm))
    
    elif pattern == "noise":
        for i in range(duration_s):
            bpm = baseline_mean + random.uniform(-10, 15)
            sequence.append((now + timedelta(seconds=i), bpm))
    
    elif pattern == "spike":
        for i in range(duration_s):
            if i == 10:  # spike singolo
                bpm = baseline_mean + 30
            else:
                bpm = baseline_mean + random.uniform(-2, 2)
            sequence.append((now + timedelta(seconds=i), bpm))
    
    else:
        # default: none
        for i in range(duration_s):
            bpm = baseline_mean + random.uniform(-2, 2)
            sequence.append((now + timedelta(seconds=i), bpm))
    
    return sequence

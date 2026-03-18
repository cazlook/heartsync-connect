import math
import random
import logging
from typing import Optional, Tuple

logger = logging.getLogger("heartsync.geo")

# ── Configurazione privacy geo ──────────────────────────────────────────────

# MAI restituire coordinate precise. Mostrare solo distanza approssimata.
# Questo protegge gli utenti dalla localizzazione fisica.

# Livelli di precisione della distanza (km)
DISTANCE_BUCKETS_KM = [
    (0.5,  "Vicinissimo"),    # < 500m
    (1,    "A meno di 1 km"),
    (2,    "A circa 1-2 km"),
    (5,    "A pochi km"),
    (10,   "A meno di 10 km"),
    (25,   "A circa 10-25 km"),
    (50,   "A meno di 50 km"),
    (100,  "Nella stessa area"),
    (300,  "Nella tua regione"),
    (float("inf"), "Lontano"),
]

# Jitter massimo aggiunto alle coordinate prima di salvarle (gradi)
# 0.01 gradi ~ 1.1 km: impedisce triangolazione precisa
COORDINATE_JITTER_DEG = 0.01


# ── Funzioni principali ──────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calcola la distanza in km tra due coordinate (formula di Haversine).
    Usata INTERNAMENTE: MAI esporre lat/lon delle API al frontend.
    """
    R = 6371.0  # raggio della Terra in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def distance_to_label(distance_km: float) -> str:
    """
    Converte una distanza in km in un'etichetta approssimata leggibile.
    MAI restituire la distanza precisa: arrotonda sempre al bucket superiore.
    """
    for threshold, label in DISTANCE_BUCKETS_KM:
        if distance_km <= threshold:
            return label
    return "Lontano"


def get_approximate_distance_label(
    user_lat: float,
    user_lon: float,
    other_lat: float,
    other_lon: float,
) -> str:
    """
    API principale: ritorna solo l'etichetta di distanza approssimata.
    NON ritorna mai coordinate precise o distanza esatta.
    """
    try:
        km = haversine_km(user_lat, user_lon, other_lat, other_lon)
        return distance_to_label(km)
    except Exception:
        return "Nelle vicinanze"


def add_coordinate_jitter(
    lat: float,
    lon: float,
    jitter_deg: float = COORDINATE_JITTER_DEG,
) -> Tuple[float, float]:
    """
    Aggiunge un offset casuale alle coordinate prima di salvarle nel DB.
    Impedisce la triangolazione precisa anche se il DB venisse compromesso.
    Il jitter e' consistente per sessione (non cambia ad ogni richiesta).
    """
    jitter_lat = random.uniform(-jitter_deg, jitter_deg)
    jitter_lon = random.uniform(-jitter_deg, jitter_deg)
    return round(lat + jitter_lat, 4), round(lon + jitter_lon, 4)


def sanitize_location_for_api(
    lat: float,
    lon: float,
    viewer_lat: Optional[float] = None,
    viewer_lon: Optional[float] = None,
) -> dict:
    """
    Prepara i dati di localizzazione per l'API.
    Regola CRITICA: non includere mai lat/lon nelle risposte API.
    Restituisce solo: distanza_label, e nulla di piu'.
    """
    result = {}
    if viewer_lat is not None and viewer_lon is not None:
        result["distance_label"] = get_approximate_distance_label(
            viewer_lat, viewer_lon, lat, lon
        )
    else:
        result["distance_label"] = "Nelle vicinanze"

    # MAI aggiungere lat/lon al risultato
    return result


def validate_coordinates(lat: float, lon: float) -> bool:
    """Verifica che le coordinate siano valide."""
    return -90 <= lat <= 90 and -180 <= lon <= 180

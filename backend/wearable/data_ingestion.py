"""
Wearable Data Ingestion Layer - HeartSync Connect

Riceve e normalizza dati di battito cardiaco da:
  - Apple HealthKit (iOS)
  - Google Fit / Health Connect (Android)
  - Fitbit API (opzionale)
  - Garmin Connect API (opzionale)

Dati richiesti: Heart Rate (BPM) + Timestamp, frequenza minima 1Hz.
NESSUN utilizzo di camera, rPPG o sensori non-wearable.

Privacy: dati biometrici classificati come dati sensibili GDPR Art.9.
Tutti i dati vengono cifrati prima della persistenza.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
import statistics


# ---------------------------------------------------------------------------
# Tipi e costanti
# ---------------------------------------------------------------------------

class WearableSource(str, Enum):
    APPLE_HEALTHKIT = "apple_healthkit"
    GOOGLE_FIT = "google_fit"
    HEALTH_CONNECT = "health_connect"
    FITBIT = "fitbit"
    GARMIN = "garmin"
    UNKNOWN = "unknown"


# Frequenza minima accettata (campioni al secondo)
MIN_SAMPLE_RATE_HZ = 1

# Limiti fisiologici HR per adulti a riposo/attivita leggera
HR_PHYSIOLOGICAL_MIN = 30   # bpm
HR_PHYSIOLOGICAL_MAX = 220  # bpm


@dataclass
class HRSample:
    """
    Singolo campione di frequenza cardiaca da wearable.
    Rappresentazione interna normalizzata (source-agnostic).
    """
    bpm: float                         # Battiti per minuto
    timestamp: datetime                # UTC
    source: WearableSource             # Dispositivo di origine
    user_id: str                       # ID utente HeartSync
    confidence: float = 1.0            # 0.0-1.0 (Fitbit/Garmin forniscono questo valore)
    raw_payload: Optional[dict] = None # Payload originale per debug (non persistito)

    def is_physiologically_valid(self) -> bool:
        """Scarta campioni fuori range fisiologico."""
        return HR_PHYSIOLOGICAL_MIN <= self.bpm <= HR_PHYSIOLOGICAL_MAX


@dataclass
class HRBatch:
    """
    Batch di campioni HR inviati in un singolo push dall'app mobile.
    Viene creato dal frontend dopo aver letto i dati dal wearable SDK.
    """
    user_id: str
    source: WearableSource
    samples: List[HRSample] = field(default_factory=list)
    device_model: Optional[str] = None   # es. "Apple Watch Series 9"
    received_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def duration_seconds(self) -> float:
        """Durata della finestra temporale del batch."""
        if len(self.samples) < 2:
            return 0.0
        ts_list = [s.timestamp.timestamp() for s in self.samples]
        return max(ts_list) - min(ts_list)

    def effective_sample_rate(self) -> float:
        """Frequenza di campionamento effettiva (Hz)."""
        dur = self.duration_seconds()
        if dur <= 0:
            return 0.0
        return len(self.samples) / dur


# ---------------------------------------------------------------------------
# Normalizzatori per ogni sorgente
# ---------------------------------------------------------------------------

def _parse_apple_healthkit(payload: dict, user_id: str) -> List[HRSample]:
    """
    Normalizza il payload JSON inviato dall'SDK iOS.

    Formato atteso (array di campioni da HealthKit HKQuantityTypeIdentifierHeartRate):
    [
      {"startDate": "2026-03-17T10:00:00Z", "value": 72.0, "unit": "count/min"},
      ...
    ]
    """
    samples = []
    for item in payload.get("samples", []):
        try:
            ts = datetime.fromisoformat(
                item["startDate"].replace("Z", "+00:00")
            )
            bpm = float(item["value"])
            sample = HRSample(
                bpm=bpm,
                timestamp=ts,
                source=WearableSource.APPLE_HEALTHKIT,
                user_id=user_id,
                confidence=1.0,
                raw_payload=item
            )
            if sample.is_physiologically_valid():
                samples.append(sample)
        except (KeyError, ValueError):
            continue
    return samples


def _parse_google_fit(payload: dict, user_id: str) -> List[HRSample]:
    """
    Normalizza il payload da Google Fit / Health Connect.

    Formato atteso (DataPoint da com.google.heart_rate.bpm):
    {
      "dataPoints": [
        {
          "startTimeNanos": "1710669600000000000",
          "value": [{"fpVal": 74.0}]
        }
      ]
    }
    """
    samples = []
    for dp in payload.get("dataPoints", []):
        try:
            nanos = int(dp["startTimeNanos"])
            ts = datetime.fromtimestamp(nanos / 1e9, tz=timezone.utc)
            bpm = float(dp["value"][0]["fpVal"])
            sample = HRSample(
                bpm=bpm,
                timestamp=ts,
                source=WearableSource.GOOGLE_FIT,
                user_id=user_id,
                confidence=1.0,
                raw_payload=dp
            )
            if sample.is_physiologically_valid():
                samples.append(sample)
        except (KeyError, ValueError, IndexError):
            continue
    return samples


def _parse_fitbit(payload: dict, user_id: str) -> List[HRSample]:
    """
    Normalizza il payload dall'API Fitbit Intraday.

    Formato atteso:
    {
      "activities-heart-intraday": {
        "dataset": [
          {"time": "10:00:00", "value": 70},
          ...
        ],
        "datasetInterval": 1,
        "datasetType": "second"
      },
      "date": "2026-03-17"
    }
    """
    samples = []
    intraday = payload.get("activities-heart-intraday", {})
    date_str = payload.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    dataset = intraday.get("dataset", [])

    for entry in dataset:
        try:
            ts_str = f"{date_str}T{entry['time']}+00:00"
            ts = datetime.fromisoformat(ts_str)
            bpm = float(entry["value"])
            sample = HRSample(
                bpm=bpm,
                timestamp=ts,
                source=WearableSource.FITBIT,
                user_id=user_id,
                confidence=0.95,
                raw_payload=entry
            )
            if sample.is_physiologically_valid():
                samples.append(sample)
        except (KeyError, ValueError):
            continue
    return samples


def _parse_garmin(payload: dict, user_id: str) -> List[HRSample]:
    """
    Normalizza il payload dall'API Garmin Health SDK.

    Formato atteso:
    {
      "heartRateValues": [
        [1710669600, 73],  # [unix_timestamp, bpm]
        ...
      ]
    }
    """
    samples = []
    for entry in payload.get("heartRateValues", []):
        try:
            ts = datetime.fromtimestamp(entry[0], tz=timezone.utc)
            bpm = float(entry[1])
            sample = HRSample(
                bpm=bpm,
                timestamp=ts,
                source=WearableSource.GARMIN,
                user_id=user_id,
                confidence=0.95,
                raw_payload=entry
            )
            if sample.is_physiologically_valid():
                samples.append(sample)
        except (IndexError, ValueError):
            continue
    return samples


# ---------------------------------------------------------------------------
# Ingestion gateway pubblico
# ---------------------------------------------------------------------------

_PARSERS = {
    WearableSource.APPLE_HEALTHKIT: _parse_apple_healthkit,
    WearableSource.HEALTH_CONNECT:  _parse_google_fit,
    WearableSource.GOOGLE_FIT:      _parse_google_fit,
    WearableSource.FITBIT:          _parse_fitbit,
    WearableSource.GARMIN:          _parse_garmin,
}


def ingest_hr_payload(
    user_id: str,
    source: WearableSource,
    payload: dict,
    device_model: Optional[str] = None,
) -> HRBatch:
    """
    Punto di ingresso unico per tutti i wearable.

    Passaggi:
      1. Seleziona il parser corretto in base alla sorgente.
      2. Normalizza i campioni in HRSample.
      3. Ordina per timestamp.
      4. Verifica frequenza minima 1 Hz.
      5. Restituisce un HRBatch pronto per il signal processor.

    Args:
        user_id:      ID utente HeartSync (stringa UUID)
        source:       Enum WearableSource
        payload:      Dizionario JSON grezzo proveniente dall'app mobile
        device_model: Modello dispositivo opzionale (per logging)

    Returns:
        HRBatch con campioni validi, ordinati, pronti per l'elaborazione.

    Raises:
        ValueError: se la frequenza effettiva e sotto 1 Hz
        ValueError: se il payload non contiene campioni validi
    """
    parser = _PARSERS.get(source)
    if parser is None:
        raise ValueError(f"Sorgente non supportata: {source}")

    samples = parser(payload, user_id)

    if not samples:
        raise ValueError(
            f"Nessun campione HR valido nel payload da {source.value} per user {user_id}"
        )

    # Ordina campioni per timestamp crescente
    samples.sort(key=lambda s: s.timestamp)

    batch = HRBatch(
        user_id=user_id,
        source=source,
        samples=samples,
        device_model=device_model,
    )

    # Verifica frequenza minima solo se la finestra e >= 2 secondi
    if batch.duration_seconds() >= 2.0:
        rate = batch.effective_sample_rate()
        if rate < MIN_SAMPLE_RATE_HZ:
            raise ValueError(
                f"Frequenza campionamento troppo bassa: {rate:.2f} Hz "
                f"(minimo richiesto: {MIN_SAMPLE_RATE_HZ} Hz)"
            )

    return batch


def validate_wearable_consent(user_data: dict) -> bool:
    """
    Verifica che l'utente abbia fornito consenso esplicito
    al trattamento di dati biometrici (GDPR Art.9).

    Args:
        user_data: Dizionario dati utente dal database

    Returns:
        bool: True se consenso valido e presente
    """
    consent = user_data.get("biometric_consent", {})
    return (
        consent.get("given", False) is True
        and consent.get("timestamp") is not None
        and consent.get("version") is not None
    )

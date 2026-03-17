"""
Signal Processing - Baseline Dinamica + Filtri Anti-Rumore
Per rilevare reazioni cardiache genuine durante visualizzazione profili.
"""
from dataclasses import dataclass
from collections import deque
from typing import List, Optional
import statistics
from data_ingestion import HRSample

# Parametri baseline
BASELINE_WINDOW_SEC = 60
BASELINE_INIT_SEC = 25
BASELINE_MAX_STD = 3
ANOMALY_SPIKE_BPM = 10

@dataclass
class UserBaseline:
    user_id: str
    mean_bpm: float
    std_bpm: float
    window: deque  # rolling window ultimi 60 sec
    is_stable: bool
    updated_at: float

    def update(self, samples: List[HRSample]):
        for s in samples:
            if abs(s.bpm - self.mean_bpm) > ANOMALY_SPIKE_BPM:
                continue  # scarta spike
            self.window.append(s.bpm)
        
        if len(self.window) < 10:
            return
        
        vals = list(self.window)
        self.mean_bpm = statistics.mean(vals)
        self.std_bpm = statistics.stdev(vals) if len(vals) > 1 else 0.0
        self.is_stable = self.std_bpm < BASELINE_MAX_STD

def init_baseline(user_id: str, samples: List[HRSample]) -> UserBaseline:
    """Fase iniziale: 20-30 sec a riposo."""
    bpms = [s.bpm for s in samples[:30]]
    return UserBaseline(
        user_id=user_id,
        mean_bpm=statistics.mean(bpms),
        std_bpm=statistics.stdev(bpms) if len(bpms) > 1 else 0.0,
        window=deque(bpms, maxlen=60),
        is_stable=True,
        updated_at=samples[-1].timestamp.timestamp()
    )

def is_signal_stable(samples: List[HRSample]) -> bool:
    """Filtra segnali instabili (alta variabilita)."""
    if len(samples) < 3:
        return False
    bpms = [s.bpm for s in samples]
    return statistics.stdev(bpms) < BASELINE_MAX_STD

def detect_reaction(baseline: UserBaseline, samples: List[HRSample]) -> Optional[dict]:
    """Rileva se c'e un picco HR significativo."""
    if not baseline.is_stable:
        return None
    
    bpms = [s.bpm for s in samples]
    peak = max(bpms)
    delta = peak - baseline.mean_bpm
    
    # Verifica soglia minima +3 bpm
    if delta < 3:
        return None
    
    # Trova latency (tempo al picco)
    peak_idx = bpms.index(peak)
    latency = (samples[peak_idx].timestamp - samples[0].timestamp).total_seconds()
    
    # Calcola durata sopra soglia (baseline + 2 bpm)
    threshold = baseline.mean_bpm + 2
    above_threshold = [s for s in samples if s.bpm > threshold]
    duration = len(above_threshold)  # in secondi (1Hz)
    
    # Filtri anti-rumore
    if latency > 6:  # troppo lento
        return None
    if duration < 1:  # troppo breve
        return None
    if not is_signal_stable(samples):  # segnale instabile
        return None
    
    return {
        'delta_bpm': delta,
        'peak_bpm': peak,
        'latency_sec': latency,
        'duration_sec': duration,
        'baseline_mean': baseline.mean_bpm,
        'is_valid': True
    }

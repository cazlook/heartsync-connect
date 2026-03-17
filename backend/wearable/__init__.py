"""Wearable HR Matching Module - Modulo completo per matching basato su HR da wearables.

Componenti:
- data_ingestion: Integrazione con HealthKit, Google Fit, Fitbit, Garmin
- signal_processor: Analisi baseline dinamica e rilevamento reazioni
- reaction_scorer: Calcolo punteggi reazioni (ΔHR, latency, duration)
- wearable_matcher: Matching bidirezionale e gestione reazioni reciproche
"""

from .data_ingestion import WearableDataIngestion
from .signal_processor import SignalProcessor
from .reaction_scorer import ReactionScorer
from .wearable_matcher import WearableMatcher

__all__ = [
    'WearableDataIngestion',
    'SignalProcessor',
    'ReactionScorer',
    'WearableMatcher'
]

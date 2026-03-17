"""Reaction Scorer - Calcola punteggi di reazione cardiaca.

Formula: score = w1*ΔHR_norm + w2*duration_norm + w3*latency_inverse
"""
from typing import Dict, Optional
from datetime import datetime


class ReactionScorer:
    """Calcola punteggi di reazione basati su ΔHR, latency e duration."""
    
    def __init__(self):
        # Pesi per la formula di scoring (somma = 1.0)
        self.w_delta_hr = 0.50  # Peso per ΔHR normalizzato
        self.w_duration = 0.30  # Peso per durata normalizzata
        self.w_latency = 0.20   # Peso per latency inversa normalizzata
        
        # Normalizzazione: valori massimi attesi
        self.max_delta_hr = 30  # bpm oltre baseline
        self.max_duration = 20  # secondi
        self.max_latency = 5    # secondi (latency più bassa = meglio)
    
    def calculate_score(self, reaction_data: Dict) -> float:
        """Calcola punteggio di reazione (0-100).
        
        Args:
            reaction_data: {
                'delta_bpm': float,
                'peak_bpm': float,
                'latency_sec': float,
                'duration_sec': float
            }
        
        Returns:
            Punteggio 0-100
        """
        delta_hr = reaction_data.get('delta_bpm', 0)
        duration = reaction_data.get('duration_sec', 0)
        latency = reaction_data.get('latency_sec', self.max_latency)
        
        # Normalizza ΔHR (0-1)
        delta_hr_norm = min(delta_hr / self.max_delta_hr, 1.0)
        
        # Normalizza durata (0-1)
        duration_norm = min(duration / self.max_duration, 1.0)
        
        # Normalizza latency inversa (latency bassa = punteggio alto)
        # latency_inverse = (max - actual) / max
        latency_inverse = max(0, (self.max_latency - latency) / self.max_latency)
        
        # Applica formula pesata
        score_normalized = (
            self.w_delta_hr * delta_hr_norm +
            self.w_duration * duration_norm +
            self.w_latency * latency_inverse
        )
        
        # Scala a 0-100
        return round(score_normalized * 100, 2)
    
    def is_significant_reaction(self, reaction_data: Dict, threshold: float = 30.0) -> bool:
        """Verifica se la reazione supera la soglia di significatività.
        
        Args:
            reaction_data: Dati reazione
            threshold: Punteggio minimo (default 30/100)
        
        Returns:
            True se reazione significativa
        """
        score = self.calculate_score(reaction_data)
        return score >= threshold
    
    def grade_reaction(self, score: float) -> str:
        """Classifica reazione in base al punteggio.
        
        Args:
            score: Punteggio 0-100
        
        Returns:
            Grado: 'low', 'medium', 'high', 'very_high'
        """
        if score >= 70:
            return 'very_high'
        elif score >= 50:
            return 'high'
        elif score >= 30:
            return 'medium'
        else:
            return 'low'
    
    def create_reaction_record(self, 
                              user_id: int, 
                              target_user_id: int,
                              reaction_data: Dict) -> Dict:
        """Crea record completo di reazione per storage.
        
        Args:
            user_id: ID utente che ha avuto la reazione
            target_user_id: ID utente target
            reaction_data: Dati della reazione
        
        Returns:
            Record completo con score e metadata
        """
        score = self.calculate_score(reaction_data)
        grade = self.grade_reaction(score)
        
        return {
            'user_id': user_id,
            'target_user_id': target_user_id,
            'score': score,
            'grade': grade,
            'delta_bpm': reaction_data.get('delta_bpm'),
            'peak_bpm': reaction_data.get('peak_bpm'),
            'latency_sec': reaction_data.get('latency_sec'),
            'duration_sec': reaction_data.get('duration_sec'),
            'timestamp': datetime.utcnow().isoformat(),
            'is_valid': reaction_data.get('is_valid', True)
        }

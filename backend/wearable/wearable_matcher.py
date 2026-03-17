"""Wearable Matcher - Matching bidirezionale basato su reazioni HR.

Gestisce il matching reciproco tra utenti con reazioni cardiache significative.
"""
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class WearableMatcher:
    """Gestisce il matching bidirezionale basato su reazioni cardiache."""
    
    def __init__(self, db_connection):
        self.db = db_connection
        self.min_score_threshold = 30.0  # Punteggio minimo per reazione valida
        self.mutual_boost_factor = 1.5   # Boost per reazioni reciproche
        self.time_window_hours = 24      # Finestra temporale per matching
    
    def find_mutual_reactions(self, user_id: int, target_user_id: int, 
                             time_window_hours: int = 24) -> Optional[Dict]:
        """Cerca reazioni reciproche tra due utenti.
        
        Args:
            user_id: ID primo utente
            target_user_id: ID secondo utente
            time_window_hours: Finestra temporale (default 24h)
        
        Returns:
            Dict con dettagli match reciproco o None
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=time_window_hours)
        
        # Query reazione A -> B
        query_a_to_b = """
            SELECT score, delta_bpm, peak_bpm, latency_sec, duration_sec, timestamp
            FROM heart_reactions
            WHERE user_id = %s AND target_user_id = %s 
            AND timestamp >= %s AND is_valid = TRUE
            ORDER BY score DESC LIMIT 1
        """
        
        # Query reazione B -> A
        query_b_to_a = """
            SELECT score, delta_bpm, peak_bpm, latency_sec, duration_sec, timestamp
            FROM heart_reactions
            WHERE user_id = %s AND target_user_id = %s 
            AND timestamp >= %s AND is_valid = TRUE
            ORDER BY score DESC LIMIT 1
        """
        
        with self.db.cursor() as cursor:
            # Reazione A -> B
            cursor.execute(query_a_to_b, (user_id, target_user_id, cutoff_time))
            reaction_a_to_b = cursor.fetchone()
            
            # Reazione B -> A
            cursor.execute(query_b_to_a, (target_user_id, user_id, cutoff_time))
            reaction_b_to_a = cursor.fetchone()
        
        # Verifica se entrambe le reazioni esistono e superano soglia
        if reaction_a_to_b and reaction_b_to_a:
            if (reaction_a_to_b['score'] >= self.min_score_threshold and 
                reaction_b_to_a['score'] >= self.min_score_threshold):
                
                # Calcola punteggio combinato con boost
                combined_score = (
                    (reaction_a_to_b['score'] + reaction_b_to_a['score']) / 2
                ) * self.mutual_boost_factor
                
                return {
                    'user_id': user_id,
                    'target_user_id': target_user_id,
                    'mutual': True,
                    'combined_score': round(combined_score, 2),
                    'user_to_target_score': reaction_a_to_b['score'],
                    'target_to_user_score': reaction_b_to_a['score'],
                    'detected_at': datetime.utcnow().isoformat()
                }
        
        return None
    
    def check_and_create_match(self, user_id: int, target_user_id: int) -> Optional[int]:
        """Verifica reazioni reciproche e crea match se valido.
        
        Args:
            user_id: ID primo utente
            target_user_id: ID secondo utente
        
        Returns:
            Match ID se creato, None altrimenti
        """
        mutual_reaction = self.find_mutual_reactions(user_id, target_user_id)
        
        if mutual_reaction:
            # Verifica se match già esistente
            existing_match = self._get_existing_match(user_id, target_user_id)
            if existing_match:
                logger.info(f"Match already exists: {existing_match}")
                return existing_match
            
            # Crea nuovo match
            match_id = self._create_match_record(mutual_reaction)
            logger.info(f"Created mutual match {match_id} for users {user_id} <-> {target_user_id}")
            return match_id
        
        return None
    
    def _get_existing_match(self, user_id: int, target_user_id: int) -> Optional[int]:
        """Cerca match esistente tra due utenti."""
        query = """
            SELECT id FROM matches
            WHERE (user1_id = %s AND user2_id = %s) 
               OR (user1_id = %s AND user2_id = %s)
            LIMIT 1
        """
        with self.db.cursor() as cursor:
            cursor.execute(query, (user_id, target_user_id, target_user_id, user_id))
            result = cursor.fetchone()
            return result['id'] if result else None
    
    def _create_match_record(self, mutual_reaction: Dict) -> int:
        """Crea record di match nel database."""
        query = """
            INSERT INTO matches 
            (user1_id, user2_id, match_score, match_type, matched_at, status)
            VALUES (%s, %s, %s, 'wearable_mutual', %s, 'active')
            RETURNING id
        """
        with self.db.cursor() as cursor:
            cursor.execute(query, (
                mutual_reaction['user_id'],
                mutual_reaction['target_user_id'],
                mutual_reaction['combined_score'],
                datetime.utcnow()
            ))
            self.db.commit()
            return cursor.fetchone()['id']
    
    def get_top_reactions_for_user(self, user_id: int, limit: int = 10) -> List[Dict]:
        """Ottieni le reazioni più forti di un utente (anche non reciproche).
        
        Args:
            user_id: ID utente
            limit: Numero massimo risultati
        
        Returns:
            Lista di reazioni ordinate per score
        """
        query = """
            SELECT target_user_id, score, delta_bpm, peak_bpm, 
                   latency_sec, duration_sec, timestamp
            FROM heart_reactions
            WHERE user_id = %s AND is_valid = TRUE
            ORDER BY score DESC
            LIMIT %s
        """
        with self.db.cursor() as cursor:
            cursor.execute(query, (user_id, limit))
            return cursor.fetchall()
    
    def batch_check_mutual_matches(self, user_id: int) -> List[int]:
        """Verifica match reciproci per tutte le reazioni recenti di un utente.
        
        Args:
            user_id: ID utente
        
        Returns:
            Lista di match_id creati
        """
        reactions = self.get_top_reactions_for_user(user_id, limit=50)
        match_ids = []
        
        for reaction in reactions:
            match_id = self.check_and_create_match(user_id, reaction['target_user_id'])
            if match_id:
                match_ids.append(match_id)
        
        return match_ids

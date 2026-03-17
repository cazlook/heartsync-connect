"""
Heart Reveal - Funzione virale per aumentare engagement

Analizza le interazioni dell'utente e crea suspense rivelando
con chi ha avuto la "reazione del cuore" più forte.

Messaggio: "Il tuo cuore ha reagito fortemente a qualcuno... vuoi scoprire chi?"
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional
import random


class HeartRevealAnalyzer:
    """
    Analizza le interazioni utente per creare momenti di suspense.
    Non è un'analisi medica, ma un modo giocoso per aumentare engagement.
    """
    
    # Pesi per calcolare "reazione del cuore"
    INTERACTION_WEIGHTS = {
        'profile_view': 1,
        'photo_view': 2,
        'swipe_right': 3,
        'super_like': 5,
        'message_sent': 4,
        'message_length': 0.1,  # per carattere
        'response_speed': 2,  # risposta veloce = interesse
        'chat_duration': 0.5,  # per minuto
        'event_invite': 6,
    }
    
    # Soglia minima per attivare Heart Reveal
    MIN_SCORE_THRESHOLD = 15
    
    # Giorni di attesa prima di mostrare Heart Reveal
    DAYS_WAIT = 2
    
    @staticmethod
    async def calculate_heart_score(db, user_id: str, target_user_id: str, 
                                    days_back: int = 7) -> float:
        """
        Calcola lo "score del cuore" basato sulle interazioni.
        
        Args:
            db: Database connection
            user_id: ID utente che sta interagendo
            target_user_id: ID utente target
            days_back: Giorni di storia da analizzare
            
        Returns:
            float: Score di "reazione del cuore" (0-100)
        """
        score = 0.0
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)
        
        # 1. Visualizzazioni profilo
        profile_views = await db.interactions.count_documents({
            'user_id': user_id,
            'target_user_id': target_user_id,
            'type': 'profile_view',
            'timestamp': {'$gte': cutoff_date}
        })
        score += profile_views * HeartRevealAnalyzer.INTERACTION_WEIGHTS['profile_view']
        
        # 2. Like e Super Like
        likes = await db.interactions.find_one({
            'user_id': user_id,
            'target_user_id': target_user_id,
            'type': {'$in': ['like', 'super_like']},
            'timestamp': {'$gte': cutoff_date}
        })
        if likes:
            like_type = likes.get('type')
            if like_type == 'super_like':
                score += HeartRevealAnalyzer.INTERACTION_WEIGHTS['super_like']
            else:
                score += HeartRevealAnalyzer.INTERACTION_WEIGHTS['swipe_right']
        
        # 3. Messaggi inviati
        messages = await db.messages.find({
            'sender_id': user_id,
            'match_id': {'$regex': target_user_id},
            'timestamp': {'$gte': cutoff_date}
        }).to_list(None)
        
        if messages:
            # Conta messaggi
            score += len(messages) * HeartRevealAnalyzer.INTERACTION_WEIGHTS['message_sent']
            
            # Analizza lunghezza messaggi (interesse = messaggi più lunghi)
            total_chars = sum(len(msg.get('message', '')) for msg in messages)
            score += total_chars * HeartRevealAnalyzer.INTERACTION_WEIGHTS['message_length']
            
            # Analizza velocità di risposta
            fast_responses = 0
            for i, msg in enumerate(messages):
                if i > 0:
                    time_diff = (msg['timestamp'] - messages[i-1]['timestamp']).total_seconds() / 60
                    if time_diff < 5:  # Risposta entro 5 minuti
                        fast_responses += 1
            score += fast_responses * HeartRevealAnalyzer.INTERACTION_WEIGHTS['response_speed']
        
        # 4. Inviti a eventi
        event_invites = await db.event_participants.count_documents({
            'inviter_id': user_id,
            'invited_match_id': target_user_id,
            'created_at': {'$gte': cutoff_date}
        })
        score += event_invites * HeartRevealAnalyzer.INTERACTION_WEIGHTS['event_invite']
        
        # Normalizza score (max 100)
        return min(score, 100.0)
    
    @staticmethod
    async def find_top_heart_reaction(db, user_id: str, limit: int = 3) -> List[Dict]:
        """
        Trova i top 3 utenti con cui l'utente ha avuto la reazione più forte.
        
        Args:
            db: Database connection
            user_id: ID utente
            limit: Numero di risultati
            
        Returns:
            List[Dict]: Lista di utenti con score
        """
        # Trova tutti i match e interazioni recenti
        matches = await db.matches.find({
            '$or': [
                {'user1_id': user_id},
                {'user2_id': user_id}
            ]
        }).to_list(None)
        
        results = []
        
        for match in matches:
            target_id = match['user2_id'] if match['user1_id'] == user_id else match['user1_id']
            
            score = await HeartRevealAnalyzer.calculate_heart_score(db, user_id, target_id)
            
            if score >= HeartRevealAnalyzer.MIN_SCORE_THRESHOLD:
                # Ottieni info utente
                target_user = await db.users.find_one({'id': target_id})
                if target_user:
                    results.append({
                        'user_id': target_id,
                        'name': target_user.get('name', 'Qualcuno'),
                        'photo_url': target_user.get('photos', [None])[0],
                        'heart_score': round(score, 1),
                        'match_id': match['id']
                    })
        
        # Ordina per score decrescente
        results.sort(key=lambda x: x['heart_score'], reverse=True)
        
        return results[:limit]
    
    @staticmethod
    async def should_show_heart_reveal(db, user_id: str) -> bool:
        """
        Determina se mostrare Heart Reveal all'utente.
        
        Condizioni:
        - Almeno 2 giorni di attività
        - Non mostrato negli ultimi 7 giorni
        - Esiste almeno 1 match con score alto
        
        Args:
            db: Database connection
            user_id: ID utente
            
        Returns:
            bool: True se mostrare Heart Reveal
        """
        # Controlla quando l'utente si è registrato
        user = await db.users.find_one({'id': user_id})
        if not user:
            return False
        
        registration_date = user.get('created_at')
        if not registration_date:
            return False
        
        # Deve essere registrato da almeno DAYS_WAIT giorni
        days_since_registration = (datetime.utcnow() - registration_date).days
        if days_since_registration < HeartRevealAnalyzer.DAYS_WAIT:
            return False
        
        # Controlla se già mostrato recentemente
        recent_reveal = await db.heart_reveals.find_one({
            'user_id': user_id,
            'shown_at': {'$gte': datetime.utcnow() - timedelta(days=7)}
        })
        if recent_reveal:
            return False
        
        # Verifica se esistono match con score alto
        top_matches = await HeartRevealAnalyzer.find_top_heart_reaction(db, user_id, limit=1)
        
        return len(top_matches) > 0
    
    @staticmethod
    async def create_heart_reveal_notification(db, user_id: str) -> Optional[Dict]:
        """
        Crea una notifica Heart Reveal per l'utente.
        
        Args:
            db: Database connection
            user_id: ID utente
            
        Returns:
            Dict: Dati della notifica o None
        """
        if not await HeartRevealAnalyzer.should_show_heart_reveal(db, user_id):
            return None
        
        top_match = await HeartRevealAnalyzer.find_top_heart_reaction(db, user_id, limit=1)
        if not top_match:
            return None
        
        top_match = top_match[0]
        
        # Messaggi casuali per varia suspense
        messages = [
            f"💓 Il tuo cuore ha reagito fortemente a qualcuno... vuoi scoprire chi?",
            f"❤️ Scopri a chi reagisce il tuo cuore!",
            f"💖 C'è qualcuno che ha catturato il tuo cuore... ",
            f"💘 Il tuo cuore batte forte per qualcuno. Scopri chi!",
        ]
        
        notification = {
            'user_id': user_id,
            'type': 'heart_reveal',
            'title': 'Heart Reveal',
            'message': random.choice(messages),
            'data': {
                'revealed_user_id': top_match['user_id'],
                'revealed_user_name': top_match['name'],
                'heart_score': top_match['heart_score'],
                'match_id': top_match['match_id']
            },
            'created_at': datetime.utcnow(),
            'read': False
        }
        
        # Salva nel database
        await db.notifications.insert_one(notification)
        
        # Registra che Heart Reveal è stato mostrato
        await db.heart_reveals.insert_one({
            'user_id': user_id,
            'revealed_user_id': top_match['user_id'],
            'shown_at': datetime.utcnow(),
            'score': top_match['heart_score']
        })
        
        return notification
    
    @staticmethod
    def get_heart_reveal_message(score: float) -> str:
        """
        Genera messaggio personalizzato basato sullo score.
        
        Args:
            score: Heart score (0-100)
            
        Returns:
            str: Messaggio personalizzato
        """
        if score >= 70:
            return "🔥 Il tuo cuore batte fortissimo! C'è una connessione speciale."
        elif score >= 50:
            return "✨ C'è una bella sintonia tra voi due!"
        elif score >= 30:
            return "💕 Il tuo cuore ha notato qualcuno di interessante."
        else:
            return "💓 C'è qualcosa che attira il tuo cuore..."


async def schedule_heart_reveal_notifications(db):
    """
    Task schedulato che controlla periodicamente quali utenti
    dovrebbero ricevere Heart Reveal.
    
    Da eseguire 1-2 volte al giorno.
    """
    # Trova utenti attivi negli ultimi 3 giorni
    cutoff = datetime.utcnow() - timedelta(days=3)
    active_users = await db.users.find({
        'last_active': {'$gte': cutoff}
    }).to_list(None)
    
    count = 0
    for user in active_users:
        notification = await HeartRevealAnalyzer.create_heart_reveal_notification(
            db, user['id']
        )
        if notification:
            count += 1
            print(f"Heart Reveal sent to user {user['id']}")
    
    print(f"Total Heart Reveals sent: {count}")
    return count

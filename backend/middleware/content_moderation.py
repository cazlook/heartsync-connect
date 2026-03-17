"""
Content Moderation Middleware - HeartSync Connect

Gestione moderazione contenuti:
- Filtraggio messaggi spam/offensivi
- Scansione foto per contenuti inappropriati
- Sistema di segnalazioni utenti
- Protezione da bot
Conforme al GDPR e alle normative EU.
"""

from datetime import datetime
from typing import List, Optional
import re


# --- Parole Vietate ---
# Lista base di parole offensive/spam (da espandere con dataset completi)
BANNED_WORDS = [
    # Spam patterns
    'buy now', 'click here', 'free money', 'earn cash',
    'whatsapp', 'telegram me', 'call me', 'my number is',
    # Offensive content (placeholder - usare libreria dedicata in produzione)
    # ... aggiungere lista completa
]

# Pattern regex per rilevare informazioni di contatto esterne
CONTACT_PATTERNS = [
    r'\b\d{10,}\b',  # Numeri di telefono
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # Email
    r'(?i)(instagram|facebook|snapchat|tiktok|twitter)\s*[@:]?\s*\w+',  # Social
    r'(?i)wa\.me\/|t\.me\/',  # WhatsApp/Telegram links
]


class ContentModerator:
    """
    Sistema di moderazione contenuti per HeartSync Connect.
    Protegge gli utenti da spam, abusi e contenuti inappropriati.
    """
    
    @staticmethod
    def check_message(text: str) -> dict:
        """
        Analizza un messaggio in chat.
        
        Args:
            text: Testo del messaggio
            
        Returns:
            dict: {'allowed': bool, 'reason': str, 'flagged': bool}
        """
        if not text or len(text.strip()) == 0:
            return {'allowed': False, 'reason': 'Messaggio vuoto'}
        
        text_lower = text.lower()
        
        # 1. Controlla lunghezza
        if len(text) > 2000:
            return {
                'allowed': False,
                'reason': 'Messaggio troppo lungo (max 2000 caratteri)',
                'flagged': False
            }
        
        # 2. Controlla parole vietate
        for word in BANNED_WORDS:
            if word in text_lower:
                return {
                    'allowed': False,
                    'reason': 'Contenuto non consentito rilevato',
                    'flagged': True,
                    'violation_type': 'banned_word'
                }
        
        # 3. Controlla pattern di contatti esterni (nei primi messaggi)
        for pattern in CONTACT_PATTERNS:
            if re.search(pattern, text):
                return {
                    'allowed': False,
                    'reason': 'Per la tua sicurezza, non condividere informazioni di contatto nelle prime conversazioni.',
                    'flagged': True,
                    'violation_type': 'external_contact'
                }
        
        # 4. Controlla spam (stesso messaggio ripetuto)
        # Implementato nel database tramite query
        
        return {'allowed': True, 'flagged': False}
    
    @staticmethod
    def check_bio(text: str) -> dict:
        """
        Analizza la bio/descrizione del profilo.
        
        Args:
            text: Testo della bio
            
        Returns:
            dict: {'allowed': bool, 'reason': str}
        """
        if not text:
            return {'allowed': True}  # Bio vuota e consentita
        
        if len(text) > 500:
            return {
                'allowed': False,
                'reason': 'Bio troppo lunga (max 500 caratteri)'
            }
        
        text_lower = text.lower()
        for word in BANNED_WORDS:
            if word in text_lower:
                return {
                    'allowed': False,
                    'reason': 'La bio contiene contenuti non consentiti',
                    'flagged': True
                }
        
        return {'allowed': True}
    
    @staticmethod
    def check_username(username: str) -> dict:
        """
        Valida il nome utente.
        
        Args:
            username: Nome utente scelto
            
        Returns:
            dict: {'valid': bool, 'reason': str}
        """
        if not username or len(username.strip()) < 2:
            return {'valid': False, 'reason': 'Nome troppo corto (min 2 caratteri)'}
        
        if len(username) > 50:
            return {'valid': False, 'reason': 'Nome troppo lungo (max 50 caratteri)'}
        
        # Solo lettere, numeri, spazi e trattini
        if not re.match(r'^[a-zA-Z0-9\s\-\_]+$', username):
            return {
                'valid': False,
                'reason': 'Il nome puo contenere solo lettere, numeri e trattini'
            }
        
        return {'valid': True}


async def report_user(db, reporter_id: str, reported_id: str, reason: str, 
                      evidence: Optional[str] = None) -> dict:
    """
    Gestisce la segnalazione di un utente.
    
    Args:
        db: Database connection
        reporter_id: ID utente che segnala
        reported_id: ID utente segnalato
        reason: Motivo della segnalazione
        evidence: Testo/URL come prova (opzionale)
        
    Returns:
        dict: Risultato della segnalazione
    """
    valid_reasons = [
        'spam', 'inappropriate_photo', 'harassment', 
        'underage', 'fake_profile', 'scam', 'other'
    ]
    
    if reason not in valid_reasons:
        return {'success': False, 'error': 'Motivo non valido'}
    
    # Conta segnalazioni recenti per lo stesso reporter (anti-abuse)
    from datetime import timedelta
    recent_reports = await db.reports.count_documents({
        'reporter_id': reporter_id,
        'created_at': {'$gte': datetime.utcnow() - timedelta(hours=24)}
    })
    
    if recent_reports >= 10:
        return {
            'success': False,
            'error': 'Hai raggiunto il limite di segnalazioni giornaliere'
        }
    
    # Salva la segnalazione
    report = {
        'reporter_id': reporter_id,
        'reported_id': reported_id,
        'reason': reason,
        'evidence': evidence,
        'status': 'pending',
        'created_at': datetime.utcnow()
    }
    
    await db.reports.insert_one(report)
    
    # Controlla se utente ha molte segnalazioni (soglia = 5 in 30 giorni)
    from datetime import timedelta
    total_reports = await db.reports.count_documents({
        'reported_id': reported_id,
        'created_at': {'$gte': datetime.utcnow() - timedelta(days=30)}
    })
    
    if total_reports >= 5:
        # Sospendi automaticamente l'account
        await db.users.update_one(
            {'id': reported_id},
            {'$set': {
                'is_suspended': True,
                'suspension_reason': f'Multiple reports: {total_reports} in 30 days',
                'suspended_at': datetime.utcnow()
            }}
        )
        print(f'User {reported_id} auto-suspended: {total_reports} reports in 30 days')
    
    return {
        'success': True,
        'message': 'Segnalazione ricevuta. Il nostro team la revisioner\u00e0 entro 24 ore.'
    }


async def block_user(db, blocker_id: str, blocked_id: str) -> dict:
    """
    Blocca un utente (nasconde i profili reciprocamente).
    
    Args:
        db: Database connection
        blocker_id: Chi blocca
        blocked_id: Chi viene bloccato
    """
    existing = await db.blocks.find_one({
        'blocker_id': blocker_id,
        'blocked_id': blocked_id
    })
    
    if existing:
        return {'success': False, 'message': 'Utente gia bloccato'}
    
    await db.blocks.insert_one({
        'blocker_id': blocker_id,
        'blocked_id': blocked_id,
        'created_at': datetime.utcnow()
    })
    
    # Cancella eventuali match esistenti
    await db.matches.delete_many({
        '$or': [
            {'user1_id': blocker_id, 'user2_id': blocked_id},
            {'user1_id': blocked_id, 'user2_id': blocker_id}
        ]
    })
    
    return {'success': True, 'message': 'Utente bloccato con successo'}

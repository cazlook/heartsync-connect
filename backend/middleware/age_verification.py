"""
Age Verification Middleware - HeartSync Connect

Verifica che tutti gli utenti abbiano almeno 18 anni.
Blocca la registrazione e l'accesso ai minori.
Conforme al GDPR e alle normative sulle app di incontri.
"""

from datetime import datetime, date
from functools import wraps
from flask import request, jsonify
from typing import Optional


# Eta minima richiesta
MINIMUM_AGE = 18


def calculate_age(birth_date) -> int:
    """
    Calcola l'eta corrente a partire dalla data di nascita.
    
    Args:
        birth_date: Data di nascita (date o datetime o stringa ISO)
        
    Returns:
        int: Eta in anni
    """
    if isinstance(birth_date, str):
        birth_date = datetime.fromisoformat(birth_date).date()
    elif isinstance(birth_date, datetime):
        birth_date = birth_date.date()
    
    today = date.today()
    age = today.year - birth_date.year
    
    # Correggi se non ha ancora compiuto gli anni quest'anno
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    
    return age


def is_adult(birth_date) -> bool:
    """
    Verifica se l'utente e maggiorenne.
    
    Args:
        birth_date: Data di nascita
        
    Returns:
        bool: True se >= 18 anni
    """
    try:
        age = calculate_age(birth_date)
        return age >= MINIMUM_AGE
    except (ValueError, TypeError):
        return False  # In caso di errore, blocca per sicurezza


def require_adult(f):
    """
    Decorator: Verifica che l'utente corrente sia maggiorenne.
    Usa i dati dell'utente autenticato.
    
    Uso:
        @app.route('/api/profiles')
        @require_jwt
        @require_adult
        def get_profiles():
            ...
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user:
            return jsonify({'error': 'Autenticazione richiesta'}), 401
        
        birth_date = user.get('date_of_birth') or user.get('birth_date')
        
        if not birth_date:
            return jsonify({
                'error': 'Data di nascita non trovata nel profilo',
                'code': 'AGE_VERIFICATION_REQUIRED'
            }), 403
        
        if not is_adult(birth_date):
            return jsonify({
                'error': 'Accesso vietato: devi avere almeno 18 anni',
                'code': 'UNDERAGE_USER',
                'message': 'HeartSync Connect e riservato agli utenti maggiorenni (18+).'
            }), 403
        
        return f(*args, **kwargs)
    
    return decorated_function


def validate_registration_age(birth_date_str: str) -> dict:
    """
    Valida l'eta durante la registrazione.
    
    Args:
        birth_date_str: Data di nascita come stringa (ISO format: YYYY-MM-DD)
        
    Returns:
        dict: {'valid': bool, 'age': int, 'error': str}
    """
    if not birth_date_str:
        return {
            'valid': False,
            'error': 'La data di nascita e obbligatoria',
            'code': 'MISSING_BIRTH_DATE'
        }
    
    try:
        birth_date = datetime.strptime(birth_date_str, '%Y-%m-%d').date()
    except ValueError:
        try:
            birth_date = datetime.fromisoformat(birth_date_str).date()
        except ValueError:
            return {
                'valid': False,
                'error': 'Formato data non valido. Usa YYYY-MM-DD',
                'code': 'INVALID_DATE_FORMAT'
            }
    
    # Verifica che la data non sia nel futuro
    if birth_date > date.today():
        return {
            'valid': False,
            'error': 'La data di nascita non puo essere nel futuro',
            'code': 'FUTURE_DATE'
        }
    
    # Verifica eta massima realistica (120 anni)
    age = calculate_age(birth_date)
    if age > 120:
        return {
            'valid': False,
            'error': 'Data di nascita non valida',
            'code': 'INVALID_DATE'
        }
    
    # Verifica eta minima 18 anni
    if age < MINIMUM_AGE:
        return {
            'valid': False,
            'age': age,
            'error': f'Devi avere almeno {MINIMUM_AGE} anni per registrarti.',
            'message': 'HeartSync Connect e riservato agli utenti maggiorenni.',
            'code': 'UNDERAGE'
        }
    
    return {
        'valid': True,
        'age': age
    }


async def flag_suspicious_age_profile(db, user_id: str, reason: str):
    """
    Segnala un profilo sospetto per possibile violazione eta.
    Usato quando le foto o il comportamento sembrano di un minore.
    
    Args:
        db: Database connection
        user_id: ID utente da segnalare
        reason: Motivo della segnalazione
    """
    await db.moderation_flags.insert_one({
        'user_id': user_id,
        'type': 'age_concern',
        'reason': reason,
        'flagged_at': datetime.utcnow(),
        'status': 'pending_review',
        'auto_flagged': True
    })
    
    # Disabilita temporaneamente l'account in attesa di revisione
    await db.users.update_one(
        {'id': user_id},
        {'$set': {
            'is_suspended': True,
            'suspension_reason': 'age_verification_required',
            'suspended_at': datetime.utcnow()
        }}
    )
    
    print(f'User {user_id} flagged for age concern: {reason}')

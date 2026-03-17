"""Wearable API Endpoints - REST API per sistema HR matching da wearable.

Endpoints:
- POST /api/wearable/consent - Gestione consenso biometrico
- POST /api/wearable/connect - Collegamento wearable account
- GET /api/wearable/reactions - Lista reazioni utente
- GET /api/wearable/matches/mutual - Match reciproci
- DELETE /api/wearable/data - Right to erasure (GDPR)
"""
from flask import Blueprint, request, jsonify
from functools import wraps
import logging
from datetime import datetime

from .auth import verify_jwt_token
from .wearable.data_ingestion import WearableDataIngestion
from .wearable.wearable_matcher import WearableMatcher
from .middleware.rate_limiter import limiter
from .dependencies import get_db_connection

logger = logging.getLogger(__name__)
wearable_bp = Blueprint('wearable', __name__, url_prefix='/api/wearable')


def require_biometric_consent(f):
    """Decorator: verifica consenso biometrico prima di accedere a dati HR."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = request.user_id  # Set da verify_jwt_token
        
        db = get_db_connection()
        with db.cursor() as cursor:
            cursor.execute(
                "SELECT consent_given, consent_withdrawn FROM biometric_consents "
                "WHERE user_id = %s AND purpose = 'heart_rate_matching'",
                (user_id,)
            )
            consent = cursor.fetchone()
        
        if not consent or not consent['consent_given'] or consent['consent_withdrawn']:
            return jsonify({
                'error': 'biometric_consent_required',
                'message': 'Consenso biometrico necessario per questa funzionalità'
            }), 403
        
        return f(*args, **kwargs)
    return decorated_function


@wearable_bp.route('/consent', methods=['POST'])
@verify_jwt_token
@limiter.limit("5 per minute")
def manage_biometric_consent():
    """Gestisce consenso biometrico GDPR Art. 9.
    
    Body:
    {
        "consent_given": true/false,
        "data_retention_days": 90  (opzionale)
    }
    """
    data = request.get_json()
    user_id = request.user_id
    consent_given = data.get('consent_given', False)
    retention_days = data.get('data_retention_days', 90)
    
    db = get_db_connection()
    
    if consent_given:
        # Crea o aggiorna consenso
        query = """
            INSERT INTO biometric_consents 
            (user_id, consent_given, consent_timestamp, data_retention_days, purpose)
            VALUES (%s, TRUE, %s, %s, 'heart_rate_matching')
            ON CONFLICT (user_id, purpose) DO UPDATE
            SET consent_given = TRUE, 
                consent_timestamp = %s,
                consent_withdrawn = FALSE,
                data_retention_days = %s,
                updated_at = NOW()
            RETURNING id
        """
        with db.cursor() as cursor:
            cursor.execute(query, (
                user_id, datetime.utcnow(), retention_days,
                datetime.utcnow(), retention_days
            ))
            db.commit()
            consent_id = cursor.fetchone()['id']
        
        logger.info(f"Biometric consent granted: user={user_id}, retention={retention_days}d")
        return jsonify({
            'success': True,
            'consent_id': consent_id,
            'message': 'Consenso biometrico registrato'
        })
    
    else:
        # Revoca consenso + eliminazione dati
        query_revoke = """
            UPDATE biometric_consents
            SET consent_withdrawn = TRUE, withdrawal_timestamp = %s
            WHERE user_id = %s AND purpose = 'heart_rate_matching'
        """
        query_delete = "DELETE FROM heart_reactions WHERE user_id = %s"
        
        with db.cursor() as cursor:
            cursor.execute(query_revoke, (datetime.utcnow(), user_id))
            cursor.execute(query_delete, (user_id,))
            db.commit()
        
        logger.info(f"Biometric consent withdrawn + data deleted: user={user_id}")
        return jsonify({
            'success': True,
            'message': 'Consenso revocato e dati cancellati'
        })


@wearable_bp.route('/connect', methods=['POST'])
@verify_jwt_token
@require_biometric_consent
@limiter.limit("10 per minute")
def connect_wearable():
    """Collega account wearable (HealthKit/Google Fit/Fitbit/Garmin).
    
    Body:
    {
        "platform": "apple_healthkit" | "google_fit" | "fitbit" | "garmin",
        "credentials": { ... }  // Token OAuth o auth specifici piattaforma
    }
    """
    data = request.get_json()
    user_id = request.user_id
    platform = data.get('platform')
    credentials = data.get('credentials')
    
    if platform not in ['apple_healthkit', 'google_fit', 'fitbit', 'garmin']:
        return jsonify({'error': 'invalid_platform'}), 400
    
    ingestion = WearableDataIngestion()
    
    try:
        # Valida credenziali testando fetch
        test_data = ingestion.fetch_heart_rate(
            platform=platform,
            user_credentials=credentials,
            start_time=datetime.utcnow(),
            duration_minutes=1
        )
        
        if not test_data:
            return jsonify({'error': 'invalid_credentials'}), 401
        
        # Salva credentials cifrate in DB (TODO: encryption)
        db = get_db_connection()
        query = """
            INSERT INTO wearable_connections
            (user_id, platform, credentials_encrypted, connected_at, is_active)
            VALUES (%s, %s, %s, %s, TRUE)
            ON CONFLICT (user_id, platform) DO UPDATE
            SET credentials_encrypted = %s, is_active = TRUE, updated_at = NOW()
        """
        # In produzione: encrypt(credentials) con KMS
        credentials_encrypted = str(credentials)  # TEMP: cifrare in prod!
        
        with db.cursor() as cursor:
            cursor.execute(query, (
                user_id, platform, credentials_encrypted, datetime.utcnow(),
                credentials_encrypted
            ))
            db.commit()
        
        logger.info(f"Wearable connected: user={user_id}, platform={platform}")
        return jsonify({
            'success': True,
            'platform': platform,
            'message': f'{platform} collegato con successo'
        })
    
    except Exception as e:
        logger.error(f"Wearable connection failed: {e}")
        return jsonify({'error': 'connection_failed', 'details': str(e)}), 500


@wearable_bp.route('/reactions', methods=['GET'])
@verify_jwt_token
@require_biometric_consent
@limiter.limit("30 per minute")
def get_user_reactions():
    """Ottieni le reazioni HR dell'utente autenticato.
    
    Query params:
    - limit: int (default 20, max 100)
    - min_score: float (default 0)
    """
    user_id = request.user_id
    limit = min(int(request.args.get('limit', 20)), 100)
    min_score = float(request.args.get('min_score', 0))
    
    db = get_db_connection()
    matcher = WearableMatcher(db)
    
    reactions = matcher.get_top_reactions_for_user(user_id, limit=limit)
    
    # Filtra per min_score
    filtered = [r for r in reactions if r['score'] >= min_score]
    
    return jsonify({
        'reactions': filtered,
        'count': len(filtered)
    })


@wearable_bp.route('/matches/mutual', methods=['GET'])
@verify_jwt_token
@require_biometric_consent
@limiter.limit("20 per minute")
def get_mutual_matches():
    """Ottieni i match reciproci basati su reazioni HR."""
    user_id = request.user_id
    
    db = get_db_connection()
    
    query = """
        SELECT m.id, m.user1_id, m.user2_id, m.match_score, m.matched_at,
               u1.name as user1_name, u2.name as user2_name
        FROM matches m
        JOIN users u1 ON m.user1_id = u1.id
        JOIN users u2 ON m.user2_id = u2.id
        WHERE (m.user1_id = %s OR m.user2_id = %s)
        AND m.match_type = 'wearable_mutual'
        AND m.status = 'active'
        ORDER BY m.match_score DESC
    """
    
    with db.cursor() as cursor:
        cursor.execute(query, (user_id, user_id))
        matches = cursor.fetchall()
    
    return jsonify({
        'mutual_matches': matches,
        'count': len(matches)
    })


@wearable_bp.route('/data', methods=['DELETE'])
@verify_jwt_token
@limiter.limit("2 per hour")
def delete_biometric_data():
    """GDPR Right to Erasure - Cancella tutti i dati biometrici utente.
    
    Elimina:
    - Tutte le heart_reactions
    - Tutti i match wearable_mutual
    - Revoca consenso biometrico
    """
    user_id = request.user_id
    
    db = get_db_connection()
    
    try:
        with db.cursor() as cursor:
            # Delete reactions
            cursor.execute("DELETE FROM heart_reactions WHERE user_id = %s", (user_id,))
            reactions_deleted = cursor.rowcount
            
            # Delete wearable matches
            cursor.execute(
                "DELETE FROM matches WHERE (user1_id = %s OR user2_id = %s) AND match_type = 'wearable_mutual'",
                (user_id, user_id)
            )
            matches_deleted = cursor.rowcount
            
            # Revoke consent
            cursor.execute(
                "UPDATE biometric_consents SET consent_withdrawn = TRUE, withdrawal_timestamp = %s "
                "WHERE user_id = %s",
                (datetime.utcnow(), user_id)
            )
            
            db.commit()
        
        logger.info(f"GDPR data erasure: user={user_id}, reactions={reactions_deleted}, matches={matches_deleted}")
        
        return jsonify({
            'success': True,
            'deleted': {
                'reactions': reactions_deleted,
                'matches': matches_deleted
            },
            'message': 'Tutti i dati biometrici sono stati cancellati'
        })
    
    except Exception as e:
        logger.error(f"Data erasure failed: {e}")
        db.rollback()
        return jsonify({'error': 'deletion_failed'}), 500


@wearable_bp.route('/status', methods=['GET'])
@verify_jwt_token
@limiter.limit("60 per minute")
def get_wearable_status():
    """Status wearable connection e consenso biometrico."""
    user_id = request.user_id
    
    db = get_db_connection()
    
    with db.cursor() as cursor:
        # Check consent
        cursor.execute(
            "SELECT consent_given, consent_withdrawn, data_retention_days "
            "FROM biometric_consents WHERE user_id = %s AND purpose = 'heart_rate_matching'",
            (user_id,)
        )
        consent = cursor.fetchone()
        
        # Check connected devices
        cursor.execute(
            "SELECT platform, connected_at, is_active FROM wearable_connections WHERE user_id = %s",
            (user_id,)
        )
        devices = cursor.fetchall()
    
    return jsonify({
        'consent': {
            'granted': consent['consent_given'] if consent else False,
            'withdrawn': consent['consent_withdrawn'] if consent else False,
            'retention_days': consent['data_retention_days'] if consent else None
        },
        'connected_devices': devices
    })

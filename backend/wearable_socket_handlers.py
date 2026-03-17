"""Wearable Socket Handlers - WebSocket per streaming HR real-time.

Gestisce:
- Ricezione dati HR da app mobile
- Elaborazione real-time con SignalProcessor
- Rilevamento reazioni e scoring
- Notifiche match reciproci

Da integrare in socket_server.py esistente.
"""
from flask_socketio import emit, join_room, leave_room
import logging
from datetime import datetime
from collections import defaultdict

from .wearable.signal_processor import SignalProcessor
from .wearable.reaction_scorer import ReactionScorer
from .wearable.wearable_matcher import WearableMatcher
from .dependencies import get_db_connection

logger = logging.getLogger(__name__)

# Storage in-memory per sessioni attive (in prod: usare Redis)
active_sessions = defaultdict(dict)  # {user_id: {'processor': SignalProcessor, 'viewing_user': int}}


def handle_hr_stream_start(data):
    """Handler: Utente inizia streaming HR.
    
    Emesso da mobile app quando utente apre profilo/chat.
    
    Data:
    {
        "user_id": int,
        "viewing_user_id": int  // ID profilo che sta visualizzando
    }
    """
    user_id = data.get('user_id')
    viewing_user_id = data.get('viewing_user_id')
    
    # Verifica consenso biometrico
    db = get_db_connection()
    with db.cursor() as cursor:
        cursor.execute(
            "SELECT consent_given FROM biometric_consents "
            "WHERE user_id = %s AND purpose = 'heart_rate_matching' AND consent_withdrawn = FALSE",
            (user_id,)
        )
        consent = cursor.fetchone()
    
    if not consent or not consent['consent_given']:
        emit('hr_error', {'error': 'consent_required'})
        return
    
    # Inizializza processor per sessione
    processor = SignalProcessor()
    active_sessions[user_id] = {
        'processor': processor,
        'viewing_user': viewing_user_id,
        'started_at': datetime.utcnow(),
        'baseline_initialized': False
    }
    
    # Join room per notifiche personali
    join_room(f"user_{user_id}")
    
    logger.info(f"HR stream started: user={user_id}, viewing={viewing_user_id}")
    emit('hr_stream_ready', {'status': 'ready', 'message': 'Inizia calibrazione baseline (20-30s)'})


def handle_hr_update(data):
    """Handler: Ricezione sample HR da mobile app.
    
    Emesso ogni 1-5 secondi da app mobile.
    
    Data:
    {
        "user_id": int,
        "timestamp": "ISO8601",
        "bpm": float,
        "confidence": float  (0-1)
    }
    """
    user_id = data.get('user_id')
    bpm = data.get('bpm')
    timestamp_str = data.get('timestamp')
    confidence = data.get('confidence', 1.0)
    
    session = active_sessions.get(user_id)
    if not session:
        emit('hr_error', {'error': 'session_not_started'})
        return
    
    processor = session['processor']
    viewing_user_id = session['viewing_user']
    
    # Aggiungi sample
    timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
    processor.add_sample(timestamp, bpm)
    
    # Inizializza baseline se necessario
    if not session['baseline_initialized']:
        if len(processor.samples) >= processor.baseline_window_size:
            processor.initialize_baseline()
            session['baseline_initialized'] = True
            baseline = processor.get_current_baseline()
            emit('baseline_ready', {'baseline_bpm': round(baseline, 2)})
            logger.info(f"Baseline initialized: user={user_id}, baseline={baseline:.2f}")
        else:
            # Ancora in calibrazione
            remaining = processor.baseline_window_size - len(processor.samples)
            emit('calibrating', {'samples_remaining': remaining})
        return
    
    # Aggiorna baseline rolling
    processor.update_baseline()
    
    # Rileva reazione
    reaction = processor.detect_reaction(timestamp)
    
    if reaction and reaction['is_valid']:
        # Calcola score
        scorer = ReactionScorer()
        score = scorer.calculate_score(reaction)
        grade = scorer.grade_reaction(score)
        
        logger.info(f"Reaction detected: user={user_id} -> target={viewing_user_id}, score={score}, grade={grade}")
        
        # Salva reaction in DB
        db = get_db_connection()
        with db.cursor() as cursor:
            # Get consent_id
            cursor.execute(
                "SELECT id FROM biometric_consents WHERE user_id = %s AND purpose = 'heart_rate_matching'",
                (user_id,)
            )
            consent_id = cursor.fetchone()['id']
            
            # Calculate retention expiry
            cursor.execute("SELECT calculate_retention_expiry(%s)", (user_id,))
            retention_expires = cursor.fetchone()[0]
            
            # Insert reaction
            cursor.execute(
                """INSERT INTO heart_reactions 
                   (user_id, target_user_id, score, grade, delta_bpm, peak_bpm, baseline_bpm,
                    latency_sec, duration_sec, timestamp, user_consent_id, data_retention_expires)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING id""",
                (user_id, viewing_user_id, score, grade,
                 reaction['delta_bpm'], reaction['peak_bpm'], processor.get_current_baseline(),
                 reaction['latency_sec'], reaction['duration_sec'], timestamp,
                 consent_id, retention_expires)
            )
            reaction_id = cursor.fetchone()['id']
            db.commit()
        
        # Emetti notifica a utente
        emit('reaction_detected', {
            'reaction_id': reaction_id,
            'score': score,
            'grade': grade,
            'target_user_id': viewing_user_id
        })
        
        # Check matching reciproco
        matcher = WearableMatcher(db)
        match_id = matcher.check_and_create_match(user_id, viewing_user_id)
        
        if match_id:
            # Match reciproco rilevato!
            logger.info(f"MUTUAL MATCH created: {match_id}, users={user_id}<->{viewing_user_id}")
            
            # Notifica entrambi gli utenti
            emit('mutual_match', {
                'match_id': match_id,
                'message': '💓 Match reciproco rilevato!',
                'other_user_id': viewing_user_id
            }, room=f"user_{user_id}")
            
            emit('mutual_match', {
                'match_id': match_id,
                'message': '💓 Match reciproco rilevato!',
                'other_user_id': user_id
            }, room=f"user_{viewing_user_id}")


def handle_hr_stream_stop(data):
    """Handler: Utente termina streaming HR.
    
    Data:
    {
        "user_id": int
    }
    """
    user_id = data.get('user_id')
    
    if user_id in active_sessions:
        session = active_sessions[user_id]
        processor = session['processor']
        
        # Log statistiche sessione
        logger.info(f"HR stream stopped: user={user_id}, samples={len(processor.samples)}")
        
        # Cleanup
        del active_sessions[user_id]
        leave_room(f"user_{user_id}")
        
        emit('hr_stream_stopped', {'status': 'stopped'})


def handle_hr_calibration_request(data):
    """Handler: Richiesta ricalibrazione baseline.
    
    Utile se utente cambia contesto (es. da riposo a attività).
    
    Data:
    {
        "user_id": int
    }
    """
    user_id = data.get('user_id')
    session = active_sessions.get(user_id)
    
    if not session:
        emit('hr_error', {'error': 'no_active_session'})
        return
    
    # Reset processor per nuova calibrazione
    processor = SignalProcessor()
    session['processor'] = processor
    session['baseline_initialized'] = False
    
    logger.info(f"Baseline recalibration requested: user={user_id}")
    emit('recalibration_started', {'message': 'Ricalibrazione in corso (20-30s)'})


# === DA REGISTRARE IN socket_server.py ===
"""
Aggiungere a socket_server.py:

from .wearable_socket_handlers import (
    handle_hr_stream_start,
    handle_hr_update,
    handle_hr_stream_stop,
    handle_hr_calibration_request
)

@socketio.on('hr_stream_start')
def on_hr_stream_start(data):
    handle_hr_stream_start(data)

@socketio.on('hr_update')
def on_hr_update(data):
    handle_hr_update(data)

@socketio.on('hr_stream_stop')
def on_hr_stream_stop(data):
    handle_hr_stream_stop(data)

@socketio.on('hr_calibration_request')
def on_hr_calibration_request(data):
    handle_hr_calibration_request(data)
"""

# Wearable HR Matching Implementation

## Panoramica Sistema

Sistema completo di matching basato su frequenza cardiaca (HR) da dispositivi wearable per HeartSync Connect. **NO CAMERA/rPPG** - esclusivamente integrazione con wearable commerciali.

---

## 🔌 Architettura Moduli

### 1. Data Ingestion (`backend/wearable/data_ingestion.py`)

**Integrazioni:** Apple HealthKit, Google Fit, Fitbit, Garmin

**Output Standard:**
```json
{"timestamp": "2025-01-15T14:30:00Z", "bpm": 78, "confidence": 0.95, "source": "apple_healthkit"}
```

### 2. Signal Processing (`backend/wearable/signal_processor.py`)

**Baseline Dinamica:**
- Inizializzazione: 20-30s calibrazione
- Rolling Window: 60s aggiornamento continuo
- Calcolo: Media mobile con outlier removal

**Rilevamento Reazioni:**
- Soglia: δHR ≥ 3 bpm
- Latency: < 5 sec
- Duration: ≥ 1 sec

**Filtri Anti-Rumore:**
- Latency >6s → scartata
- Duration <1s → rumore
- Frequenza eccessiva (<2min) → affaticamento

### 3. Reaction Scoring (`backend/wearable/reaction_scorer.py`)

**Formula:** `Score = w₁*ΔHR_norm + w₂*duration_norm + w₃*latency_inverse`

**Pesi:** w₁=0.50, w₂=0.30, w₃=0.20

**Grading:**
- very_high: ≥70
- high: 50-69
- medium: 30-49
- low: <30

### 4. Bidirectional Matcher (`backend/wearable/wearable_matcher.py`)

**Matching Reciproco:**
- Cerca reazioni A→B E B→A
- Finestra 24h
- Soglia minima: score ≥ 30
- Boost mutuale: +50% punteggio combinato

---

## Database Schema

### `heart_reactions`
- Metriche: score, grade, delta_bpm, peak_bpm, baseline_bpm, latency_sec, duration_sec
- GDPR: user_consent_id, encrypted_hr_data (AES-256), data_retention_expires
- Trigger auto-deletion per dati scaduti

### `biometric_consents`
- Consent tracking (Art. 9 GDPR)
- Retention policy configurabile (default 90 giorni)

---

## GDPR Compliance

1. **Consenso Esplicito:** Pop-up dedicato, revocabile
2. **Cifratura:** AES-256 at rest, TLS 1.3 in transit
3. **Data Retention:** Auto-deletion dopo 90 giorni
4. **Trasparenza:** Privacy policy aggiornata
5. **Minimizzazione:** Solo aggregati, no raw samples permanenti

---

## Flusso Completo

1. **Baseline Capture** (20-30s): App legge HR da wearable
2. **Interazione**: Confronto HR con baseline durante visualizzazione profilo
3. **Rilevamento**: ΔHR ≥ 3 bpm + latency <5s → Score 0-100
4. **Check Reciprocità**: Se B ha reagito ad A → MATCH
5. **Notifica**: "💓 Match reciproco!"

---

## Deployment

**Dependencies:** flask-socketio, numpy, cryptography

**Environment:**
```
APPLE_HEALTHKIT_APP_ID=...
GOOGLE_FIT_CLIENT_ID=...
ENCRYPTION_KEY_ARN=...
BIOMETRIC_DATA_RETENTION_DAYS=90
```

**Migration:**
```bash
psql -U postgres -d heartsync < backend/database_schema_heart_reactions.sql
```

---

## Limitazioni

- **Latency Bluetooth:** 2-8s detection delay
- **Battery:** +15-25% consumo/ora
- **Accuracy:** ±5 bpm errore sensori ottici
- **Privacy:** Dati biometrici GDPR Art. 9
- **Compatibilità:** ~60-70% utenti con wearable

---

## Checklist

- [x] Data ingestion module
- [x] Signal processor
- [x] Reaction scorer
- [x] Bidirectional matcher
- [x] DB schema GDPR-compliant
- [ ] API endpoints
- [ ] WebSocket handlers
- [ ] Mobile SDK (iOS/Android)
- [ ] Consent UI
- [ ] Privacy dashboard
- [ ] Tests + Security audit

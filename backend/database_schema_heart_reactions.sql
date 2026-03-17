-- Database Schema for Heart Reactions (Wearable HR Matching)
-- GDPR-compliant biometric data storage with encryption and consent tracking

CREATE TABLE IF NOT EXISTS heart_reactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Reaction metrics
    score DECIMAL(5,2) NOT NULL,  -- 0-100 punteggio calcolato
    grade VARCHAR(20) NOT NULL CHECK (grade IN ('low', 'medium', 'high', 'very_high')),
    
    -- Raw signal data
    delta_bpm DECIMAL(5,2) NOT NULL,  -- ΔHR oltre baseline
    peak_bpm DECIMAL(5,2) NOT NULL,   -- Picco HR assoluto
    baseline_bpm DECIMAL(5,2) NOT NULL,  -- Baseline al momento rilevamento
    latency_sec DECIMAL(5,2) NOT NULL,   -- Latenza reazione (sec)
    duration_sec DECIMAL(5,2) NOT NULL,  -- Durata reazione (sec)
    
    -- Metadata
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    is_valid BOOLEAN DEFAULT TRUE,  -- Flag per filtri anti-rumore
    
    -- GDPR compliance
    user_consent_id INTEGER REFERENCES biometric_consents(id),  -- Link a consenso utente
    encrypted_hr_data TEXT,  -- Dati HR grezzi cifrati (opzionale per audit)
    data_retention_expires TIMESTAMP,  -- Scadenza automatica cancellazione dati
    
    -- Indexes
    CONSTRAINT unique_reaction UNIQUE(user_id, target_user_id, timestamp),
    INDEX idx_user_reactions (user_id, timestamp DESC),
    INDEX idx_target_reactions (target_user_id, timestamp DESC),
    INDEX idx_score (score DESC),
    INDEX idx_mutual_check (user_id, target_user_id)
);

-- Tabella consensi biometrici GDPR
CREATE TABLE IF NOT EXISTS biometric_consents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Consent tracking
    consent_given BOOLEAN DEFAULT FALSE,
    consent_timestamp TIMESTAMP,
    consent_withdrawn BOOLEAN DEFAULT FALSE,
    withdrawal_timestamp TIMESTAMP,
    
    -- Scopo trattamento dati
    purpose TEXT NOT NULL DEFAULT 'heart_rate_matching',
    
    -- Legal basis (Art. 9 GDPR - dati biometrici)
    legal_basis VARCHAR(100) DEFAULT 'explicit_consent',
    
    -- Retention policy
    data_retention_days INTEGER DEFAULT 90,  -- Conservazione 90 giorni default
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_user_consent UNIQUE(user_id, purpose)
);

-- Trigger per auto-cancellazione dati scaduti (GDPR right to erasure)
CREATE OR REPLACE FUNCTION auto_delete_expired_reactions()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM heart_reactions
    WHERE data_retention_expires < NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_delete_reactions
AFTER INSERT ON heart_reactions
EXECUTE FUNCTION auto_delete_expired_reactions();

-- Funzione per calcolare scadenza retention
CREATE OR REPLACE FUNCTION calculate_retention_expiry(user_id INTEGER)
RETURNS TIMESTAMP AS $$
DECLARE
    retention_days INTEGER;
BEGIN
    SELECT data_retention_days INTO retention_days
    FROM biometric_consents
    WHERE biometric_consents.user_id = $1 AND purpose = 'heart_rate_matching'
    LIMIT 1;
    
    IF retention_days IS NULL THEN
        retention_days := 90;  -- Default
    END IF;
    
    RETURN NOW() + (retention_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Commenti per documentazione
COMMENT ON TABLE heart_reactions IS 'Stores heart rate reactions for wearable-based matching. GDPR-compliant biometric data with encryption and auto-deletion.';
COMMENT ON TABLE biometric_consents IS 'Tracks user consent for biometric data processing (GDPR Art. 9). Required for HR matching feature.';
COMMENT ON COLUMN heart_reactions.encrypted_hr_data IS 'AES-256 encrypted raw HR samples for audit trail. Encrypted at rest.';
COMMENT ON COLUMN heart_reactions.data_retention_expires IS 'Auto-deletion timestamp per GDPR right to erasure. Calculated from user consent retention policy.';

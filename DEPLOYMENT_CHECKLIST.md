# HeartSync Connect - Deployment Checklist

Guida completa per testare e deployare l'app localmente e in produzione.
Tutti i miglioramenti sono sul branch `improvements`.

---

## 1. SETUP LOCALE (Per Testare)

### 1.1 Clone & Branch
```bash
git clone https://github.com/cazlook/heartsync-connect.git
cd heartsync-connect
git checkout improvements
```

### 1.2 Configura Environment
```bash
cp .env.example .env
# Edita .env con le tue variabili (vedi sezione Variabili)
```

### 1.3 Installa Dipendenze Backend
```bash
cd backend
pip install -r requirements.txt
```

### 1.4 Setup Database
```bash
# Avvia PostgreSQL (es. via Docker)
docker run -d --name heartsync-postgres \
  -e POSTGRES_USER=heartsync \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=heartsync_dev \
  -p 5432:5432 postgres:15

# Esegui migrazioni
psql -U heartsync -d heartsync_dev -h localhost \
  -f backend/database_schema_heart_reactions.sql
```

### 1.5 Avvia Server Backend
```bash
cd backend
python server.py
# Server disponibile su http://localhost:5000
```

### 1.6 Avvia Frontend
```bash
cd frontend
npm install
npm run dev
# Frontend su http://localhost:3000
```

---

## 2. VARIABILI D'AMBIENTE (.env)

### Obbligatorie
```bash
# Database
DATABASE_URL=postgresql://heartsync:password@localhost:5432/heartsync_dev

# JWT
JWT_SECRET_KEY=your-super-secret-jwt-key-change-this
JWT_REFRESH_SECRET_KEY=your-refresh-secret-key-change-this
JWT_EXPIRY_HOURS=24

# App
FLASK_ENV=development
FLASK_DEBUG=true

# CORS (dev locale)
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

### Per Wearable HR (opzionale in dev)
```bash
APPLE_HEALTHKIT_APP_ID=com.heartsync.connect.dev
GOOGLE_FIT_CLIENT_ID=xxx.apps.googleusercontent.com
FITBIT_CLIENT_ID=xxx
FITBIT_CLIENT_SECRET=xxx
GARMIN_CONSUMER_KEY=xxx
GARMIN_CONSUMER_SECRET=xxx
BIOMETRIC_DATA_RETENTION_DAYS=90
```

### Per Produzione (extra)
```bash
FLASK_ENV=production
FLASK_DEBUG=false
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
S3_BUCKET_NAME=heartsync-media
ENCRYPTION_KEY_ARN=arn:aws:kms:...
```

---

## 3. CHECKLIST SICUREZZA

- [ ] `JWT_SECRET_KEY` cambiato (non lasciare default)
- [ ] `JWT_REFRESH_SECRET_KEY` cambiato
- [ ] Database password robusta
- [ ] CORS configurato con origini specifiche
- [ ] Rate limiting attivo
- [ ] HTTPS in produzione (SSL/TLS)
- [ ] Variabili sensibili mai nel codice
- [ ] `.env` in `.gitignore`

---

## 4. CHECKLIST GDPR

- [ ] Privacy Policy pubblicata
- [ ] Cookie banner implementato
- [ ] Consenso biometrico UI (per HR matching)
- [ ] Endpoint cancellazione account
- [ ] Endpoint export dati utente
- [ ] Retention automatica dati biometrici (90gg)
- [ ] DPO nominato (se necessario)
- [ ] Registro trattamenti dati aggiornato

---

## 5. CHECKLIST MOBILE APP STORES

### Apple App Store
- [ ] `NSHealthShareUsageDescription` in Info.plist
- [ ] HealthKit capability abilitata
- [ ] App Review: dichiarazione uso dati biometrici
- [ ] Privacy nutrition label compilato
- [ ] 18+ age rating impostato

### Google Play Store
- [ ] `ACTIVITY_RECOGNITION` permission dichiarata
- [ ] `BODY_SENSORS` permission dichiarata
- [ ] Data Safety form compilato
- [ ] Age restriction: 18+

---

## 6. TEST ENDPOINTS

### Auth
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"Test123!","name":"Test","age":25}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"Test123!"}'
```

### Wearable
```bash
# Consenso biometrico
curl -X POST http://localhost:5000/api/wearable/consent \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"consent_given":true,"data_retention_days":90}'

# Status wearable
curl http://localhost:5000/api/wearable/status \
  -H 'Authorization: Bearer TOKEN'

# Cancellazione dati biometrici
curl -X DELETE http://localhost:5000/api/wearable/data \
  -H 'Authorization: Bearer TOKEN'
```

### Verifiche Rate Limiting
```bash
# Test rate limit (>10 richieste/min su login)
for i in {1..15}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -d '{"email":"x@x.com","password":"wrong"}'
done
# Deve restituire 429 Too Many Requests
```

---

## 7. STRUTTURA FILE CREATI (Branch improvements)

```
backend/
  wearable/
    __init__.py            - Module exports
    data_ingestion.py      - HealthKit, Google Fit, Fitbit, Garmin
    signal_processor.py    - Baseline dinamica + rilevamento reazioni
    reaction_scorer.py     - Formula: w1*dHR + w2*duration + w3*latency
    wearable_matcher.py    - Matching bidirezionale reciproco
  wearable_api.py          - REST API endpoints
  wearable_socket_handlers.py  - WebSocket streaming HR
  database_schema_heart_reactions.sql  - Schema DB + GDPR
  auth.py                  - JWT + refresh tokens
  middleware/
    rate_limiter.py        - Rate limiting dinamico
  utils/
    heart_reveal.py        - Feature Heart Reveal
  age_verification.py      - Verifica 18+
  content_moderation.py    - Content moderation
  matching_algorithm.py    - Algoritmo matching
  s3_upload.py             - Upload media S3
  requirements.txt         - Dipendenze aggiornate
mobile_sdk/
  ios_healthkit_integration.swift   - SDK iOS
  android_googlefit_integration.kt  - SDK Android
  README.md                         - Guida integrazione
GDPR_COMPLIANCE.md
IMPLEMENTATION_GUIDE.md
WEARABLE_HR_IMPLEMENTATION.md
DEPLOYMENT_CHECKLIST.md  (questo file)
.env.example
README.md
```

---

## 8. MERGE IN PRODUZIONE

```bash
# Quando pronto per produzione
git checkout main
git merge improvements
git push origin main
```

> **Attenzione**: Prima del merge, assicurarsi che tutti i test passino e la checklist sicurezza sia completata.

---

Per qualsiasi dubbio: consultare `IMPLEMENTATION_GUIDE.md` e `WEARABLE_HR_IMPLEMENTATION.md`.

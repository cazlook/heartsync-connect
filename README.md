# HeartSync Connect

> Piattaforma di dating moderna e sicura con funzionalità di matching intelligente, eventi sociali e chat real-time.

## 📋 Panoramica

HeartSync Connect è un'applicazione di dating completa che combina:
- 🧠 **Matching intelligente** basato su interessi, posizione e compatibilità
- 💬 **Chat real-time** con WebSocket
- 🎉 **Eventi sociali** con possibilità di invitare i propri match
- 🔐 **Sicurezza avanzata** con JWT, rate limiting e protezione CORS
- 📱 **Notifiche push** tramite Firebase Cloud Messaging
- 🖼️ **Upload sicuro** su AWS S3

## 🚀 Quick Start

### Prerequisiti

- Python 3.9+
- Node.js 16+
- PostgreSQL
- Account AWS (per S3)
- Account Stripe (per pagamenti)
- Account Firebase (per notifiche push)

### Installazione

1. **Clona il repository**
```bash
git clone https://github.com/cazlook/heartsync-connect.git
cd heartsync-connect
```

2. **Configura ambiente backend**
```bash
cd backend
pip install -r requirements.txt
```

3. **Configura variabili d'ambiente**

Crea un file `.env` nella root del progetto:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/heartsync

# JWT
JWT_SECRET_KEY=your-super-secret-key-change-this
JWT_REFRESH_SECRET_KEY=your-refresh-secret-key

# AWS S3
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=heartsync-uploads
AWS_REGION=us-east-1

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Firebase
FIREBASE_CREDENTIALS_PATH=./firebase-adminsdk.json

# Ambiente
ENVIRONMENT=development
FRONTEND_URL=http://localhost:5173
```

4. **Avvia il backend**
```bash
cd backend
python server.py
```

5. **Configura e avvia frontend**
```bash
cd frontend
npm install
npm run dev
```

## 📂 Struttura Progetto

```
heartsync-connect/
├── backend/
│   ├── middleware/
│   │   └── rate_limiter.py      # Rate limiting per protezione API
│   ├── utils/
│   │   ├── matching_algorithm.py # Algoritmo di matching
│   │   └── s3_upload.py         # Upload sicuro su S3
│   ├── models.py                 # Modelli database
│   ├── auth.py                   # Autenticazione JWT
│   ├── server.py                 # API principale
│   ├── socket_server.py          # WebSocket server
│   └── requirements.txt          # Dipendenze Python
├── frontend/
│   ├── src/
│   │   ├── components/          # Componenti React
│   │   ├── pages/               # Pagine applicazione
│   │   └── utils/               # Utility frontend
│   └── package.json             # Dipendenze Node.js
├── tests/                        # Test automatici
├── .env.example                  # Template variabili ambiente
└── README.md
```

## 🔑 Funzionalità Principali

### 1. Sistema di Autenticazione
- ✅ Registrazione e login con JWT
- ✅ Refresh token automatico
- ✅ Logout sicuro con blacklist token
- ✅ Protezione CORS dinamica (dev/prod)

### 2. Matching Intelligente
- ✅ Algoritmo basato su:
  - Interessi comuni
  - Distanza geografica
  - Compatibilità età
- ✅ Score di compatibilità calcolato dinamicamente

### 3. Eventi Sociali
- ✅ Creazione e partecipazione eventi
- ✅ **NUOVO**: Invita i tuoi match agli eventi
- ✅ Geolocalizzazione eventi
- ✅ Notifiche push per nuovi eventi

### 4. Chat Real-time
- ✅ WebSocket per messaggi istantanei
- ✅ Notifiche desktop e mobile
- ✅ Upload immagini in chat

### 5. Sicurezza
- ✅ Rate limiting (100 req/min per IP)
- ✅ CORS configurabile per ambiente
- ✅ Validazione input con Pydantic
- ✅ Protezione SQL injection
- ✅ Upload file sicuro con controllo MIME type

## 🛠️ Configurazione Avanzata

### Rate Limiting

Il rate limiting è configurato in `backend/middleware/rate_limiter.py`:
- **Default**: 100 richieste/minuto per IP
- Personalizzabile per endpoint specifici

### CORS

Configurazione dinamica in base all'ambiente:
- **Development**: `http://localhost:5173`
- **Production**: Il tuo dominio da variabile d'ambiente

### Upload File

Limiti configurati:
- **Max size**: 5MB
- **Formati supportati**: JPG, PNG, GIF, WEBP
- **Storage**: AWS S3

## 📊 Database

### Modelli Principali

- **User**: Profili utente con dati personali e preferenze
- **Match**: Relazioni di matching tra utenti
- **Message**: Messaggi chat
- **Event**: Eventi sociali
- **EventParticipant**: Partecipazioni eventi con inviti match
- **Notification**: Notifiche push

### Migrazioni

Per creare le tabelle:
```bash
cd backend
python -c "from models import db; db.create_all()"
```

## 🧪 Testing

```bash
# Esegui tutti i test
pytest tests/

# Test specifici
pytest tests/test_auth.py
pytest tests/test_matching.py
```

## 📝 API Endpoints

### Autenticazione
- `POST /api/auth/register` - Registrazione
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout

### Profilo
- `GET /api/users/me` - Profilo corrente
- `PUT /api/users/me` - Aggiorna profilo
- `POST /api/users/upload-photo` - Upload foto profilo

### Matching
- `GET /api/matches` - Lista match
- `POST /api/matches/:id/like` - Like utente
- `POST /api/matches/:id/pass` - Pass utente

### Eventi
- `GET /api/events` - Lista eventi
- `POST /api/events` - Crea evento
- `POST /api/events/:id/join` - Partecipa evento
- `POST /api/events/:id/invite` - **NUOVO** Invita match

### Chat
- WebSocket: `ws://localhost:5000/chat`

## 🔒 Privacy e Conformità

- ✅ GDPR compliant
- ✅ Crittografia dati sensibili
- ✅ Policy cancellazione dati
- ✅ Consenso esplicito per geolocalizzazione

## 🚢 Deployment

### Backend (Heroku/Railway)

```bash
# Configura variabili ambiente
heroku config:set JWT_SECRET_KEY=...
heroku config:set DATABASE_URL=...
# ... altre variabili

# Deploy
git push heroku main
```

### Frontend (Vercel/Netlify)

```bash
npm run build
vercel deploy
```

## 📚 Risorse Aggiuntive

- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - Guida implementazione modifiche
- [Stripe Documentation](https://stripe.com/docs)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [AWS S3 Guide](https://docs.aws.amazon.com/s3/)

## 🤝 Contribuire

1. Fai un fork del progetto
2. Crea un branch per la tua feature (`git checkout -b feature/AmazingFeature`)
3. Commit delle modifiche (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

## 📄 Licenza

Questo progetto è sotto licenza MIT.

## 💬 Supporto

Per domande o problemi, apri una [Issue](https://github.com/cazlook/heartsync-connect/issues) su GitHub.

---

**Sviluppato con ❤️ per connettere le persone**

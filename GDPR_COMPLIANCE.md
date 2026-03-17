# Linee Guida Conformita GDPR - HeartSync Connect

## Principi Fondamentali

L'applicazione e progettata seguendo i principi di **Privacy by Design** e **Privacy by Default**.

---

## 1. Permessi Richiesti dall'App

| Permesso | Motivo |
|---|---|
| **Posizione GPS** | Per mostrare utenti vicini e suggerire eventi in zona. Richiesto solo durante l'uso. |
| **Fotocamera** | Per scattare e caricare foto profilo o inviare immagini in chat. |
| **Galleria/Foto** | Per selezionare foto esistenti da caricare nel profilo. |
| **Notifiche Push** | Per notificare nuovi match, messaggi, eventi vicini e Heart Reveal. |
| **Microfono** | Per messaggi vocali in chat (funzionalita futura). |

Tutti i permessi sono opzionali: l'utente puo negare qualsiasi permesso, con limitazione della funzionalita corrispondente.

---

## 2. Verifica Eta 18+

- **Data di Nascita**: Richiesta obbligatoriamente durante la registrazione.
- **Blocco Automatico**: Account con eta inferiore a 18 anni vengono bloccati automaticamente.
- **Verifica Foto**: Integrazione futura con AI per verificare che le foto non ritraggano minori.
- **Segnalazione**: Gli utenti possono segnalare profili sospetti per revisione manuale.

---

## 3. Sistema Matching - Algoritmo

L'algoritmo calcola uno **score di compatibilita** basato su:

### Distanza Geografica (peso: 40%)
- Formula Haversine per calcolo distanza reale
- Score = max(0, 100 - (distanza_km / max_distanza) * 100)
- Massima distanza configurabile dall'utente (default: 50 km)

### Compatibilita Interessi (peso: 40%)
- Lista interessi comuni / totale interessi unici
- Categoria bonus per interessi molto specifici

### Compatibilita Eta (peso: 20%)
- Differenza eta piccola = score piu alto
- Rispetta le preferenze di eta impostate dall'utente

### Score Finale
```
final_score = (distanza * 0.4) + (interessi * 0.4) + (eta * 0.2)
```

---

## 4. Sicurezza e Privacy

### Gestione Password
- Hash con **BCrypt** (work factor >= 12)
- Password mai salvate in chiaro
- Reset password via email verificata
- Supporto futuro per autenticazione biometrica

### Crittografia Dati
- **In transito**: HTTPS/TLS 1.3 obbligatorio
- **At Rest**: Database cifrato a livello di provider (AWS RDS/PostgreSQL)
- **Foto profilo**: Salvate su S3 con URL firmati temporanei

### Protezione da Bot
- **Rate Limiting**: 100 richieste/minuto per IP
- **CAPTCHA**: Sulla registrazione e login (hCaptcha privacy-friendly)
- **Analisi comportamento**: Blocco automatico pattern sospetti
- **Email verificata**: Obbligatoria per completare la registrazione

### Moderazione Contenuti
- **Foto**: Scansione automatica con AI per rilevare contenuti espliciti/violenti
- **Messaggi**: Filtro automatico per spam e linguaggio offensivo
- **Segnalazioni**: Sistema di report utente con revisione umana entro 24h
- **Blacklist**: Parole vietate e pattern abusivi

---

## 5. Conformita GDPR

### Basi Giuridiche del Trattamento
- **Esecuzione contratto**: Dati necessari per fornire il servizio
- **Consenso esplicito**: Per dati sensibili e comunicazioni marketing
- **Legittimo interesse**: Per sicurezza e prevenzione frodi

### Diritti dell'Utente

| Diritto | Come Esercitarlo |
|---|---|
| **Accesso** | Impostazioni > I Miei Dati > Visualizza |
| **Rettifica** | Modifica diretta dal profilo |
| **Portabilita** | Impostazioni > Esporta Dati (JSON) |
| **Cancellazione** | Impostazioni > Elimina Account |
| **Revoca Consenso** | Impostazioni > Privacy > Gestisci Consensi |
| **Opposizione** | Contatta il DPO a privacy@heartsync.com |

### Conservazione Dati
- **Account attivo**: Per tutta la durata del rapporto
- **Account cancellato**: Eliminazione entro 30 giorni
- **Messaggi**: Eliminati immediatamente se richiesto
- **Log di accesso**: Conservati 90 giorni per sicurezza
- **Dati anonimizzati**: Possono essere conservati per statistiche

### Terze Parti e DPA
- **AWS S3**: Data Processing Agreement attivo - GDPR compliant
- **Stripe**: PCI-DSS Level 1 + GDPR compliant
- **Firebase (Google)**: Standard Contractual Clauses (SCC) EU

---

## 6. Heart Reveal - Note Privacy

La funzione Heart Reveal:
- **Non** utilizza sensori biometrici o dati sanitari
- Analizza esclusivamente le **interazioni nell'app** (click, messaggi, tempo di visualizzazione)
- E presentata come funzionalita di **engagement giocosa**, non come analisi medica
- I dati di interazione sono usati esclusivamente per questo scopo
- L'utente puo **disattivare** Heart Reveal nelle impostazioni privacy

---

## 7. Privacy Policy Completa

Il documento legale completo e disponibile su:
- `/privacy-policy` nell'app
- Link nel footer del sito web
- Durante la registrazione (accettazione obbligatoria)

Deve includere:
- Nome e contatti del Titolare del Trattamento
- Dati del DPO (Data Protection Officer) se necessario
- Elenco completo dei dati raccolti
- Trasferimenti internazionali di dati
- Procedure di data breach notification

---

*Data di creazione: 17 Marzo 2026 - Da aggiornare ad ogni modifica sostanziale*

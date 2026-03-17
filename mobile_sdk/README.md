# Mobile SDK - Wearable HR Integration

Esempi di integrazione iOS e Android per sistema di matching basato su frequenza cardiaca da wearable.

## File Disponibili

### iOS (Swift)
- `ios_healthkit_integration.swift` - Integrazione Apple HealthKit
  - Gestione permessi HealthKit
  - Streaming HR real-time
  - WebSocket communication con backend
  - Gestione notifiche match reciproci

### Android (Kotlin)
- `android_googlefit_integration.kt` - Integrazione Google Fit
  - Gestione permessi Google Fit
  - Sensor subscription per HR
  - WebSocket communication con backend
  - Notifiche push per match

---

## Setup Requisiti

### iOS

**Info.plist:**
```xml
<key>NSHealthShareUsageDescription</key>
<string>HeartSync utilizza i tuoi dati di frequenza cardiaca per rilevare connessioni emotive autentiche con altri utenti. I dati sono criptati e conservati solo per 90 giorni.</string>
```

**Dependencies (CocoaPods):**
```ruby
pod 'Socket.IO-Client-Swift', '~> 16.0'
```

### Android

**AndroidManifest.xml:**
```xml
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
<uses-permission android:name="android.permission.BODY_SENSORS" />
```

**build.gradle:**
```gradle
dependencies {
    implementation 'com.google.android.gms:play-services-fitness:21.1.0'
    implementation 'com.google.android.gms:play-services-auth:20.7.0'
    implementation 'io.socket:socket.io-client:2.1.0'
}
```

---

## Flusso Integrazione

1. **Richiesta Permessi**
   - iOS: HealthKit authorization
   - Android: Google Fit permissions via GoogleSignIn

2. **Consenso Biometrico Backend**
   ```
   POST /api/wearable/consent
   {"consent_given": true, "data_retention_days": 90}
   ```

3. **Connessione Wearable**
   ```
   POST /api/wearable/connect
   {"platform": "apple_healthkit", "credentials": {...}}
   ```

4. **Streaming HR (WebSocket)**
   - Emit `hr_stream_start` quando utente apre profilo
   - Emit `hr_update` ogni 1-5s con dati HR
   - Ricevi `reaction_detected` quando backend rileva reazione
   - Ricevi `mutual_match` quando match reciproco

5. **Stop Streaming**
   - Emit `hr_stream_stop` quando utente chiude profilo
   - Disconnetti WebSocket

---

## WebSocket Events

### Emessi da App
- `hr_stream_start` - Inizio sessione HR
- `hr_update` - Sample HR (ogni 1-5s)
- `hr_stream_stop` - Fine sessione
- `hr_calibration_request` - Richiesta ricalibrazione baseline

### Ricevuti da Backend
- `hr_stream_ready` - Pronto per calibrazione
- `calibrating` - Calibrazione in corso (samples_remaining)
- `baseline_ready` - Baseline inizializzata (baseline_bpm)
- `reaction_detected` - Reazione rilevata (score, grade)
- `mutual_match` - Match reciproco! (match_id, other_user_id)
- `hr_error` - Errore (consent_required, etc.)

---

## Privacy & GDPR

- **Consenso Esplicito**: Richiesto prima di accedere a HealthKit/Google Fit
- **Cifratura**: Dati trasmessi via TLS 1.3, stored con AES-256
- **Retention**: Auto-deletion dopo 90 giorni (configurabile)
- **Right to Erasure**: Endpoint `DELETE /api/wearable/data`

---

## Testing

### iOS Simulator
- Simulatore non ha sensori HR reali
- Usare dispositivo fisico con Apple Watch
- Alternativa: Mock HKHealthStore per testing

### Android Emulator
- Google Fit emulator non supporta sensori reali
- Usare dispositivo fisico con Wear OS watch
- Alternativa: Simulare dati con SensorSimulator

---

## Best Practices

1. **Battery Optimization**
   - Stop streaming quando app va in background
   - Usa sampling rate 1-5s (non più frequente)
   - Disconnetti socket quando non necessario

2. **Error Handling**
   - Gestisci permessi negati gracefully
   - Retry logic per WebSocket disconnections
   - Fallback UI se wearable non disponibile

3. **UX**
   - Progress bar durante calibrazione baseline (20-30s)
   - Visual feedback per reazioni rilevate
   - Notifiche push per match reciproci

---

## Support

Per documentazione backend completa: vedi `WEARABLE_HR_IMPLEMENTATION.md`

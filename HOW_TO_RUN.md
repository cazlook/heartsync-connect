# Guida all'avvio locale - SyncLove

Questa guida spiega come avviare SyncLove in locale per testare le funzionalità biometriche sul proprio dispositivo.

## 1. Requisiti
- Node.js & npm
- Python 3.9+
- Expo Go installato sul telefono (iOS/Android)

## 2. Avvio del Backend (FastAPI)
Il backend gestisce la logica di matching e i dati biometrici.

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Su Windows: venv\Scripts\activate
pip install -r requirements.txt
python server.py
```
Il server sarà attivo su `http://localhost:8000`.

## 3. Avvio del Frontend (Expo)
Il frontend è un'app React Native gestita con Expo.

```bash
cd frontend
npm install
npx expo start
```

## 4. Test sul Telefono (QR Code)
1. Assicurati che il telefono e il computer siano sulla stessa rete Wi-Fi.
2. Scansiona il **QR code** che appare nel terminale usando la fotocamera (iOS) o l'app Expo Go (Android).
3. L'app verrà caricata sul tuo dispositivo.

## 5. Debug & Test Manuali
### Attivare il Debug Panel
Una volta nell'app:
- Accedi a **Impostazioni** > **Debug Mode**.
- Oppure usa la scorciatoia: Triple-tap sul logo SyncLove nella home.

### Eseguire runAllTests() manualmente
Nel Debug Panel troverai un pulsante **"Run Validation Suite"**:
- Cliccando su questo pulsante, l'app eseguirà `runAllTests()` dal file `biometric-test-scenarios.ts`.
- I risultati appariranno in tempo reale nel log del pannello.

## 6. Test con sensore reale
Per passare dai dati simulati ai dati reali del sensore:

### Collegare lo Smartwatch
SyncLove supporta Apple Watch e Wear OS tramite l'integrazione HealthKit/Google Fit.
1. Assicurati che lo smartwatch sia sincronizzato con il telefono.
2. Concedi i permessi di lettura dei dati cardiaci quando richiesto dall'app.

### Libreria utilizzata
SyncLove utilizza `expo-health-connect` (per Android) e `react-native-health` (per iOS) per accedere ai BPM in tempo reale. In modalità development, i dati vengono aggregati tramite un hook personalizzato che gestisce il fallback su `expo-sensors` se necessario.

### Passaggio a BPM Reale
1. Apri il **Debug Panel**.
2. Disattiva il toggle **"Simulate Biometrics"**.
3. L'app inizierà a leggere i dati direttamente dai sensori del dispositivo/watch.
4. Vedrai l'icona del cuore pulsare in base ai tuoi BPM reali.

---
**Nota**: Per il funzionamento completo, assicurati di aver configurato il file `.env` seguendo `.env.example`.

// iOS HealthKit Integration - Esempio SDK per HeartSync Connect
// Gestisce: permessi HealthKit, streaming HR real-time, invio a backend via WebSocket

import Foundation
import HealthKit
import SocketIO

class HeartSyncHealthKitManager {
    
    private let healthStore = HKHealthStore()
    private let socket: SocketIOClient
    private var heartRateQuery: HKAnchoredObjectQuery?
    private var isStreaming = false
    
    // Configurazione
    private let backendURL = "wss://api.heartsync-connect.com"  // Sostituire con URL reale
    private var userId: Int?
    private var viewingUserId: Int?
    
    init(userId: Int) {
        self.userId = userId
        
        // Inizializza socket
        let manager = SocketManager(socketURL: URL(string: backendURL)!, config: [
            .log(true),
            .compress,
            .reconnects(true)
        ])
        self.socket = manager.defaultSocket
        
        setupSocketListeners()
    }
    
    // MARK: - Permessi HealthKit
    
    func requestAuthorization(completion: @escaping (Bool, Error?) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else {
            completion(false, NSError(domain: "HealthKit", code: -1, userInfo: [NSLocalizedDescriptionKey: "HealthKit non disponibile"]))
            return
        }
        
        let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate)!
        let typesToRead: Set<HKObjectType> = [heartRateType]
        
        healthStore.requestAuthorization(toShare: nil, read: typesToRead) { success, error in
            DispatchQueue.main.async {
                completion(success, error)
            }
        }
    }
    
    // MARK: - Streaming HR
    
    func startHeartRateStreaming(viewingUserId: Int) {
        guard !isStreaming else { return }
        
        self.viewingUserId = viewingUserId
        self.isStreaming = true
        
        // Connetti socket
        socket.connect()
        
        // Notifica backend inizio stream
        socket.emit("hr_stream_start", [
            "user_id": userId!,
            "viewing_user_id": viewingUserId
        ])
        
        // Avvia query real-time HR
        startHeartRateQuery()
    }
    
    private func startHeartRateQuery() {
        let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate)!
        let predicate = HKQuery.predicateForSamples(withStart: Date(), end: nil, options: .strictStartDate)
        
        heartRateQuery = HKAnchoredObjectQuery(
            type: heartRateType,
            predicate: predicate,
            anchor: nil,
            limit: HKObjectQueryNoLimit
        ) { [weak self] query, samples, deletedObjects, anchor, error in
            self?.processHeartRateSamples(samples)
        }
        
        // Handler per aggiornamenti continui
        heartRateQuery?.updateHandler = { [weak self] query, samples, deletedObjects, anchor, error in
            self?.processHeartRateSamples(samples)
        }
        
        healthStore.execute(heartRateQuery!)
    }
    
    private func processHeartRateSamples(_ samples: [HKSample]?) {
        guard let heartRateSamples = samples as? [HKQuantitySample] else { return }
        
        for sample in heartRateSamples {
            let bpm = sample.quantity.doubleValue(for: HKUnit(from: "count/min"))
            let timestamp = sample.endDate
            
            // Invia a backend via WebSocket
            sendHeartRateUpdate(bpm: bpm, timestamp: timestamp)
        }
    }
    
    private func sendHeartRateUpdate(bpm: Double, timestamp: Date) {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        socket.emit("hr_update", [
            "user_id": userId!,
            "bpm": bpm,
            "timestamp": isoFormatter.string(from: timestamp),
            "confidence": 1.0  // HealthKit non fornisce confidence
        ])
        
        print("[HeartSync] HR sent: \(bpm) bpm at \(timestamp)")
    }
    
    func stopHeartRateStreaming() {
        guard isStreaming else { return }
        
        // Stop query
        if let query = heartRateQuery {
            healthStore.stop(query)
        }
        
        // Notifica backend stop stream
        socket.emit("hr_stream_stop", ["user_id": userId!])
        
        // Disconnetti socket
        socket.disconnect()
        
        isStreaming = false
        heartRateQuery = nil
    }
    
    // MARK: - Socket Listeners
    
    private func setupSocketListeners() {
        socket.on("hr_stream_ready") { [weak self] data, ack in
            print("[HeartSync] Stream ready: \(data)")
            // Mostra UI calibrazione baseline
        }
        
        socket.on("baseline_ready") { [weak self] data, ack in
            guard let baseline = (data[0] as? [String: Any])?["baseline_bpm"] as? Double else { return }
            print("[HeartSync] Baseline initialized: \(baseline) bpm")
            // Mostra UI "Baseline pronta, monitoring attivo"
        }
        
        socket.on("calibrating") { [weak self] data, ack in
            guard let remaining = (data[0] as? [String: Any])?["samples_remaining"] as? Int else { return }
            print("[HeartSync] Calibrating... \(remaining) samples remaining")
            // Aggiorna progress bar
        }
        
        socket.on("reaction_detected") { [weak self] data, ack in
            guard let reactionData = data[0] as? [String: Any],
                  let score = reactionData["score"] as? Double,
                  let grade = reactionData["grade"] as? String else { return }
            
            print("[HeartSync] Reaction detected! Score: \(score), Grade: \(grade)")
            // Mostra UI reazione (es. cuore animato)
        }
        
        socket.on("mutual_match") { [weak self] data, ack in
            guard let matchData = data[0] as? [String: Any],
                  let matchId = matchData["match_id"] as? Int,
                  let message = matchData["message"] as? String else { return }
            
            print("[HeartSync] MUTUAL MATCH! ID: \(matchId)")
            // Mostra notifica "💓 Match reciproco rilevato!"
            self?.showMutualMatchNotification(message: message)
        }
        
        socket.on("hr_error") { data, ack in
            print("[HeartSync] Error: \(data)")
            // Gestisci errori (es. consenso mancante)
        }
    }
    
    private func showMutualMatchNotification(message: String) {
        // TODO: Mostra push notification locale o UI in-app
        let notification = UNMutableNotificationContent()
        notification.title = "HeartSync Match!"
        notification.body = message
        notification.sound = .default
        
        let request = UNNotificationRequest(
            identifier: "mutual_match_\(UUID().uuidString)",
            content: notification,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request)
    }
}

// MARK: - Usage Example

/*
class ProfileViewController: UIViewController {
    var healthKitManager: HeartSyncHealthKitManager?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Inizializza manager
        let currentUserId = UserSession.shared.userId
        healthKitManager = HeartSyncHealthKitManager(userId: currentUserId)
        
        // Richiedi permessi HealthKit
        healthKitManager?.requestAuthorization { success, error in
            if success {
                print("HealthKit authorized")
            } else {
                print("HealthKit denied: \(error?.localizedDescription ?? "unknown")")
            }
        }
    }
    
    func didOpenUserProfile(userId: Int) {
        // Utente apre profilo di un altro utente
        healthKitManager?.startHeartRateStreaming(viewingUserId: userId)
    }
    
    func didCloseUserProfile() {
        // Utente chiude profilo
        healthKitManager?.stopHeartRateStreaming()
    }
}
*/

// MARK: - Info.plist Requirements

/*
Aggiungi in Info.plist:

<key>NSHealthShareUsageDescription</key>
<string>HeartSync utilizza i tuoi dati di frequenza cardiaca per rilevare connessioni emotive autentiche con altri utenti. I dati sono criptati e conservati solo per 90 giorni.</string>

<key>NSHealthUpdateUsageDescription</key>
<string>HeartSync needs to access your heart rate data for matching.</string>

<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
    <string>processing</string>
</array>
*/

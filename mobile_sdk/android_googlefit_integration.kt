// Android Google Fit Integration - Esempio SDK per HeartSync Connect
// Gestisce: permessi Google Fit, streaming HR real-time, invio a backend via WebSocket

package com.heartsync.connect.wearable

import android.content.Context
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.fitness.Fitness
import com.google.android.gms.fitness.FitnessOptions
import com.google.android.gms.fitness.data.DataType
import com.google.android.gms.fitness.request.OnDataPointListener
import com.google.android.gms.fitness.request.SensorRequest
import io.socket.client.IO
import io.socket.client.Socket
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

class HeartSyncGoogleFitManager(private val context: Context, private val userId: Int) {
    
    private var socket: Socket? = null
    private var isStreaming = false
    private var viewingUserId: Int? = null
    
    // Configurazione
    private val backendURL = "wss://api.heartsync-connect.com"  // Sostituire con URL reale
    
    private val fitnessOptions = FitnessOptions.builder()
        .addDataType(DataType.TYPE_HEART_RATE_BPM, FitnessOptions.ACCESS_READ)
        .build()
    
    // MARK: - Permessi Google Fit
    
    fun hasPermissions(): Boolean {
        val account = GoogleSignIn.getAccountForExtension(context, fitnessOptions)
        return GoogleSignIn.hasPermissions(account, fitnessOptions)
    }
    
    fun getFitnessOptions(): FitnessOptions = fitnessOptions
    
    // MARK: - Streaming HR
    
    fun startHeartRateStreaming(viewingUserId: Int) {
        if (isStreaming) return
        
        this.viewingUserId = viewingUserId
        this.isStreaming = true
        
        // Inizializza WebSocket
        initializeSocket()
        
        // Connetti socket
        socket?.connect()
        
        // Notifica backend inizio stream
        socket?.emit("hr_stream_start", org.json.JSONObject().apply {
            put("user_id", userId)
            put("viewing_user_id", viewingUserId)
        })
        
        // Avvia subscription Google Fit
        subscribeToHeartRate()
    }
    
    private fun initializeSocket() {
        val opts = IO.Options().apply {
            reconnection = true
            reconnectionAttempts = 10
            reconnectionDelay = 1000
        }
        
        socket = IO.socket(backendURL, opts)
        setupSocketListeners()
    }
    
    private fun subscribeToHeartRate() {
        val account = GoogleSignIn.getAccountForExtension(context, fitnessOptions)
        
        val listener = OnDataPointListener { dataPoint ->
            val bpm = dataPoint.getValue(dataPoint.dataType.fields[0]).asFloat()
            val timestamp = dataPoint.getTimestamp(TimeUnit.MILLISECONDS)
            
            sendHeartRateUpdate(bpm, timestamp)
        }
        
        val request = SensorRequest.Builder()
            .setDataType(DataType.TYPE_HEART_RATE_BPM)
            .setSamplingRate(1, TimeUnit.SECONDS)  // 1 sample/sec
            .build()
        
        Fitness.getSensorsClient(context, account)
            .add(request, listener)
            .addOnSuccessListener {
                android.util.Log.d("HeartSync", "Heart rate sensor registered")
            }
            .addOnFailureListener { e ->
                android.util.Log.e("HeartSync", "Sensor registration failed", e)
            }
    }
    
    private fun sendHeartRateUpdate(bpm: Float, timestamp: Long) {
        val isoFormatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        isoFormatter.timeZone = TimeZone.getTimeZone("UTC")
        val timestampISO = isoFormatter.format(Date(timestamp))
        
        socket?.emit("hr_update", org.json.JSONObject().apply {
            put("user_id", userId)
            put("bpm", bpm.toDouble())
            put("timestamp", timestampISO)
            put("confidence", 1.0)  // Google Fit non fornisce confidence
        })
        
        android.util.Log.d("HeartSync", "HR sent: $bpm bpm at $timestampISO")
    }
    
    fun stopHeartRateStreaming() {
        if (!isStreaming) return
        
        // Unsubscribe Google Fit
        val account = GoogleSignIn.getAccountForExtension(context, fitnessOptions)
        Fitness.getSensorsClient(context, account)
            .remove(OnDataPointListener {})
        
        // Notifica backend stop stream
        socket?.emit("hr_stream_stop", org.json.JSONObject().apply {
            put("user_id", userId)
        })
        
        // Disconnetti socket
        socket?.disconnect()
        socket = null
        
        isStreaming = false
    }
    
    // MARK: - Socket Listeners
    
    private fun setupSocketListeners() {
        socket?.on("hr_stream_ready") { args ->
            android.util.Log.d("HeartSync", "Stream ready: ${args[0]}")
            // Mostra UI calibrazione baseline
        }
        
        socket?.on("baseline_ready") { args ->
            val data = args[0] as? org.json.JSONObject
            val baseline = data?.getDouble("baseline_bpm")
            android.util.Log.d("HeartSync", "Baseline initialized: $baseline bpm")
            // Mostra UI "Baseline pronta, monitoring attivo"
        }
        
        socket?.on("calibrating") { args ->
            val data = args[0] as? org.json.JSONObject
            val remaining = data?.getInt("samples_remaining")
            android.util.Log.d("HeartSync", "Calibrating... $remaining samples remaining")
            // Aggiorna progress bar
        }
        
        socket?.on("reaction_detected") { args ->
            val data = args[0] as? org.json.JSONObject
            val score = data?.getDouble("score")
            val grade = data?.getString("grade")
            android.util.Log.d("HeartSync", "Reaction detected! Score: $score, Grade: $grade")
            // Mostra UI reazione (es. cuore animato)
        }
        
        socket?.on("mutual_match") { args ->
            val data = args[0] as? org.json.JSONObject
            val matchId = data?.getInt("match_id")
            val message = data?.getString("message")
            android.util.Log.d("HeartSync", "MUTUAL MATCH! ID: $matchId")
            // Mostra notifica "💓 Match reciproco rilevato!"
            showMutualMatchNotification(message ?: "Match!")
        }
        
        socket?.on("hr_error") { args ->
            android.util.Log.e("HeartSync", "Error: ${args[0]}")
            // Gestisci errori (es. consenso mancante)
        }
    }
    
    private fun showMutualMatchNotification(message: String) {
        // TODO: Mostra push notification locale o UI in-app
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        
        val notification = android.app.Notification.Builder(context, "heartsync_channel")
            .setContentTitle("HeartSync Match!")
            .setContentText(message)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setAutoCancel(true)
            .build()
        
        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }
}

// MARK: - Usage Example

/*
class ProfileActivity : AppCompatActivity() {
    private lateinit var googleFitManager: HeartSyncGoogleFitManager
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val currentUserId = UserSession.getUserId()
        googleFitManager = HeartSyncGoogleFitManager(this, currentUserId)
        
        // Verifica permessi
        if (!googleFitManager.hasPermissions()) {
            requestGoogleFitPermissions()
        }
    }
    
    private fun requestGoogleFitPermissions() {
        GoogleSignIn.requestPermissions(
            this,
            GOOGLE_FIT_PERMISSIONS_REQUEST_CODE,
            GoogleSignIn.getAccountForExtension(this, googleFitManager.getFitnessOptions()),
            googleFitManager.getFitnessOptions()
        )
    }
    
    fun onUserProfileOpened(userId: Int) {
        // Utente apre profilo di un altro utente
        googleFitManager.startHeartRateStreaming(viewingUserId = userId)
    }
    
    fun onUserProfileClosed() {
        // Utente chiude profilo
        googleFitManager.stopHeartRateStreaming()
    }
    
    companion object {
        private const val GOOGLE_FIT_PERMISSIONS_REQUEST_CODE = 1001
    }
}
*/

// MARK: - AndroidManifest.xml Requirements

/*
Aggiungi in AndroidManifest.xml:

<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
<uses-permission android:name="android.permission.BODY_SENSORS" />

<application>
    <meta-data
        android:name="com.google.android.gms.fitness.PERMISSION_REQUEST_TITLE"
        android:value="@string/fitness_permission_title" />
</application>

// strings.xml:
<string name="fitness_permission_title">HeartSync utilizza i tuoi dati di frequenza cardiaca per rilevare connessioni emotive autentiche. I dati sono criptati e conservati solo per 90 giorni.</string>
*/

// MARK: - build.gradle Dependencies

/*
dependencies {
    implementation 'com.google.android.gms:play-services-fitness:21.1.0'
    implementation 'com.google.android.gms:play-services-auth:20.7.0'
    implementation 'io.socket:socket.io-client:2.1.0'
}
*/

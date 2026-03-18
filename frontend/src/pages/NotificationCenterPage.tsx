// DISABILITATO: Notification center semplificato per app biometrica
export default function NotificationCenterPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="text-white text-center max-w-sm">
        <div className="text-6xl mb-4">🔔</div>
        <h2 className="text-xl font-bold mb-2">Notifiche</h2>
        <p className="text-slate-400 text-sm">
          Le notifiche di sistema sono state semplificate.
          Riceverai avvisi solo per nuovi match biometrici e messaggi.
        </p>
      </div>
    </div>
  );
}

// DISABILITATO: Gli eventi pubblici sono stati rimossi dall'app biometrica
export default function EventsPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="text-white text-center max-w-sm">
        <div className="text-6xl mb-4">🚫</div>
        <h2 className="text-xl font-bold mb-2">Feature non disponibile</h2>
        <p className="text-slate-400 text-sm">
          Gli eventi pubblici sono stati rimossi. HeartSync si concentra esclusivamente
          sulle connessioni basate su reazioni biometriche reali.
        </p>
      </div>
    </div>
  );
}

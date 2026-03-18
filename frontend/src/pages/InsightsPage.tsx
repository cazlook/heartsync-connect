// DISABILITATO: Insights/analytics rimossi dall'app biometrica
export default function InsightsPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="text-white text-center max-w-sm">
        <div className="text-6xl mb-4">🚫</div>
        <h2 className="text-xl font-bold mb-2">Feature non disponibile</h2>
        <p className="text-slate-400 text-sm">
          La sezione Insights è stata rimossa. Le statistiche biometriche saranno
          integrate direttamente nel profilo utente in futuro.
        </p>
      </div>
    </div>
  );
}

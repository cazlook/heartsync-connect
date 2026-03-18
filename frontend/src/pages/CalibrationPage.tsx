import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const CALIBRATION_DURATION = 120; // secondi
const SAMPLE_INTERVAL = 2000; // ms tra un campione e l'altro

export default function CalibrationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'intro' | 'measuring' | 'done'>('intro');
  const [secondsLeft, setSecondsLeft] = useState(CALIBRATION_DURATION);
  const [bpmSamples, setBpmSamples] = useState<number[]>([]);
  const [currentBpm, setCurrentBpm] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simula lettura BPM da sensore (in produzione: Web Bluetooth / wearable SDK)
  const readBpm = (): number => {
    const base = 65 + Math.random() * 20;
    return Math.round(base);
  };

  const startCalibration = () => {
    setPhase('measuring');
    setSecondsLeft(CALIBRATION_DURATION);
    setBpmSamples([]);

    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    sampleRef.current = setInterval(() => {
      const bpm = readBpm();
      setCurrentBpm(bpm);
      setBpmSamples(prev => [...prev, bpm]);
    }, SAMPLE_INTERVAL);

    setTimeout(() => {
      clearInterval(sampleRef.current!);
      setPhase('done');
    }, CALIBRATION_DURATION * 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (sampleRef.current) clearInterval(sampleRef.current);
    };
  }, []);

  const saveBaseline = async () => {
    if (!user || bpmSamples.length === 0) return;

    const mean = bpmSamples.reduce((a, b) => a + b, 0) / bpmSamples.length;
    const variance = bpmSamples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / bpmSamples.length;
    const stdDev = Math.sqrt(variance);

    const baseline = {
      mean_bpm: Math.round(mean),
      std_dev: parseFloat(stdDev.toFixed(2)),
      samples_count: bpmSamples.length,
      calibrated_at: new Date().toISOString(),
      baseline_calibrated: true,
    };

    await supabase
      .from('profiles')
      .update({ biometrics: baseline })
      .eq('id', user.id);

    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6 text-white">
      {phase === 'intro' && (
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-6 animate-pulse">❤️</div>
          <h1 className="text-3xl font-bold mb-4">Calibrazione Biometrica</h1>
          <p className="text-slate-300 mb-8 leading-relaxed">
            Per rilevare l'attrazione reale, dobbiamo prima misurare il tuo ritmo cardiaco a riposo.
            Siediti comodamente e rimani fermo per {CALIBRATION_DURATION / 60} minuti.
          </p>
          <div className="bg-slate-800/60 rounded-2xl p-4 mb-8 text-sm text-slate-400 text-left space-y-2">
            <p>✓ Assicurati di essere rilassato</p>
            <p>✓ Non muoverti eccessivamente</p>
            <p>✓ Tieni il dispositivo fermo</p>
          </div>
          <button
            onClick={startCalibration}
            className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-4 px-8 rounded-2xl text-lg transition-all active:scale-95"
          >
            Inizia la calibrazione
          </button>
        </div>
      )}

      {phase === 'measuring' && (
        <div className="text-center max-w-sm w-full">
          <div className="text-5xl mb-6 animate-bounce">💓</div>
          <h2 className="text-2xl font-bold mb-2">Misurazione in corso...</h2>
          <p className="text-slate-400 mb-8">Rimani fermo e rilassato</p>

          <div className="relative w-48 h-48 mx-auto mb-8">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke="#e11d48" strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (secondsLeft / CALIBRATION_DURATION)}`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{secondsLeft}s</span>
              {currentBpm && <span className="text-rose-400 text-sm">{currentBpm} BPM</span>}
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Campioni raccolti</p>
            <p className="text-white text-2xl font-bold">{bpmSamples.length}</p>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-6">✅</div>
          <h2 className="text-3xl font-bold mb-4">Calibrazione completata!</h2>
          {bpmSamples.length > 0 && (
            <div className="bg-slate-800/60 rounded-2xl p-6 mb-8 space-y-3">
              <div>
                <p className="text-slate-400 text-sm">BPM medio a riposo</p>
                <p className="text-rose-400 text-3xl font-bold">
                  {Math.round(bpmSamples.reduce((a, b) => a + b, 0) / bpmSamples.length)}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Campioni acquisiti</p>
                <p className="text-white text-xl font-bold">{bpmSamples.length}</p>
              </div>
            </div>
          )}
          <button
            onClick={saveBaseline}
            className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-4 px-8 rounded-2xl text-lg transition-all active:scale-95"
          >
            Salva e continua
          </button>
        </div>
      )}
    </div>
  );
}

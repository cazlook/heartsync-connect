import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useBiometric } from '@/hooks/useBiometric';
import { BiometricDebugPanel } from '@/components/BiometricDebugPanel';

interface Profile {
  id: string;
  full_name: string;
  age?: number;
  bio?: string;
  avatar_url?: string;
  location?: string;
}

export default function DiscoveryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reactionToast, setReactionToast] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentProfile = profiles[currentIndex] ?? null;
  const { currentBpm, reaction, isMonitoring, zScore } = useBiometric(currentProfile?.id ?? null);

  useEffect(() => { fetchProfiles(); }, []);

  const fetchProfiles = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, age, bio, avatar_url, location')
      .neq('id', user.id)
      .limit(50);
    setProfiles(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (reaction?.reacted) {
      setReactionToast('Il tuo cuore ha reagito 💓');
      setTimeout(() => setReactionToast(null), 4000);
    }
  }, [reaction]);

  const goNext = () => { if (currentIndex < profiles.length - 1) setCurrentIndex(i => i + 1); };
  const goPrev = () => { if (currentIndex > 0) setCurrentIndex(i => i - 1); };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY > 30) goNext();
    else if (e.deltaY < -30) goPrev();
  };

  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (delta > 50) goNext();
    else if (delta < -50) goPrev();
  };

  const bpmColor = () => {
    if (!currentBpm) return 'text-slate-400';
    if (zScore >= 2) return 'text-rose-400 animate-pulse';
    if (zScore >= 1) return 'text-orange-400';
    return 'text-green-400';
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-center"><div className="text-4xl mb-4 animate-pulse">❤️</div><p>Caricamento...</p></div>
    </div>
  );

  if (profiles.length === 0) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="text-white text-center"><div className="text-5xl mb-4">💔</div><h2 className="text-xl font-bold">Nessun profilo disponibile</h2></div>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-slate-900 overflow-hidden relative select-none"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      ref={containerRef}
    >
      {reactionToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white px-6 py-3 rounded-full text-sm font-medium shadow-lg animate-bounce">
          {reactionToast}
        </div>
      )}

      {isMonitoring && currentBpm && (
        <div className="fixed top-6 right-4 z-40 bg-slate-800/90 backdrop-blur rounded-2xl px-4 py-2 flex items-center gap-2">
          <span className="text-rose-500">❤</span>
          <span className={`text-sm font-bold ${bpmColor()}`}>{currentBpm} BPM</span>
        </div>
      )}

      {currentProfile && (
        <div className="h-screen flex flex-col">
          <div className="flex-1 relative overflow-hidden">
            {currentProfile.avatar_url ? (
              <img src={currentProfile.avatar_url} alt={currentProfile.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                <span className="text-8xl">👤</span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pb-24">
              <h2 className="text-white text-2xl font-bold">
                {currentProfile.full_name}{currentProfile.age ? `, ${currentProfile.age}` : ''}
              </h2>
              {currentProfile.location && <p className="text-slate-300 text-sm mt-1">📍 {currentProfile.location}</p>}
              {currentProfile.bio && <p className="text-slate-200 text-sm mt-2 line-clamp-2">{currentProfile.bio}</p>}
            </div>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1">
              {profiles.slice(0, 20).map((_, i) => (
                <div key={i} className={`h-1 rounded-full transition-all ${i === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/40'}`} />
              ))}
            </div>
          </div>
          <div className="bg-slate-900 p-4 flex justify-center">
            <button
              onClick={() => navigate(`/profile/${currentProfile.id}`)}
              className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-3 rounded-2xl text-sm font-medium transition-all"
            >
              Vedi profilo completo
            </button>
          </div>
        </div>
      )}

      <button onClick={goPrev} disabled={currentIndex === 0}
        className="fixed left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 backdrop-blur text-white p-3 rounded-full disabled:opacity-20 transition-all">
        ▲
      </button>
      <button onClick={goNext} disabled={currentIndex >= profiles.length - 1}
        className="fixed right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 backdrop-blur text-white p-3 rounded-full disabled:opacity-20 transition-all">
        ▼
      </button>
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 text-slate-500 text-xs">
        {currentIndex + 1} / {profiles.length} • Scorri per esplorare
      </div>

            {/* 🔬 Debug Panel - Only in development */}
      {__DEV__ && currentProfile && (
        <BiometricDebugPanel profileId={currentProfile.id} />
      )}
    </div>
  );
}

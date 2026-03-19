import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface BiometricMatch {
  id: string;
  user1_id: string;
  user2_id: string;
  cardiac_score: number;
  matched_at: string;
  other_profile?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    age?: number;
  };
}

export default function MatchesPageRealtime() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [matches, setMatches] = useState<BiometricMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadMatches();
  }, [user]);

  const loadMatches = async () => {
    if (!user) return;
    setLoading(true);

    const { data: matchData, error } = await supabase
      .from('matches')
      .select('id, user1_id, user2_id, cardiac_score, matched_at')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('matched_at', { ascending: false });

    if (error || !matchData) { setLoading(false); return; }

    const enriched = await Promise.all(matchData.map(async (m) => {
      const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, age')
        .eq('id', otherId)
        .single();
      return { ...m, other_profile: profile ?? undefined };
    }));

    setMatches(enriched);
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const cardiacLabel = (score: number) => {
    if (score >= 90) return { label: 'Connessione fortissima', color: 'text-rose-400' };
    if (score >= 70) return { label: 'Forte reazione', color: 'text-orange-400' };
    return { label: 'Reazione biometrica', color: 'text-yellow-400' };
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="px-4 pt-12 pb-6">
        <h1 className="text-2xl font-bold">💓 I tuoi match</h1>
        <p className="text-slate-400 text-sm mt-1">Solo match rilevati tramite reazione biometrica reale</p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="text-slate-400 animate-pulse">Caricamento...</div>
        </div>
      )}

      {!loading && matches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="text-6xl mb-4">💓</div>
          <h2 className="text-xl font-semibold mb-2">Nessun match ancora</h2>
          <p className="text-slate-400 text-sm">
            Esplora i profili: il tuo cuore reagirà quando incontri qualcuno di speciale.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 bg-rose-600 hover:bg-rose-500 text-white px-6 py-3 rounded-2xl text-sm font-medium transition-all"
          >
            Esplora profili
          </button>
        </div>
      )}

      {!loading && matches.length > 0 && (
        <div className="px-4 space-y-3 pb-24">
          {matches.map((match) => {
            const { label, color } = cardiacLabel(match.cardiac_score ?? 0);
            const profile = match.other_profile;
            return (
              <div
                key={match.id}
                onClick={() => navigate(`/chat/${match.id}`)}
                className="bg-slate-800 hover:bg-slate-700 rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-all active:scale-98"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name} className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-slate-600 flex items-center justify-center text-2xl">👤</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white truncate">
                      {profile?.full_name ?? 'Utente'}{profile?.age ? `, ${profile.age}` : ''}
                    </h3>
                    <span className="text-xs text-slate-500 shrink-0">{formatDate(match.matched_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-rose-500 text-xs">❤</span>
                    <span className={`text-xs ${color}`}>{label}</span>
                  </div>
                  {match.cardiac_score && (
                    <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full"
                        style={{ width: `${Math.min(match.cardiac_score, 100)}%` }}
                      />
                    </div>
                                            {match.confidence && (
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <span>🎯 Affidabilità:</span>
                            <span className={`font-medium ${
                              match.confidence >= 0.7 ? 'text-green-400' : 
                              match.confidence >= 0.5 ? 'text-yellow-400' : 
                              'text-orange-400'
                            }`}>
                              {Math.round(match.confidence * 100)}%
                            </span>
                          </div>
                        )}
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

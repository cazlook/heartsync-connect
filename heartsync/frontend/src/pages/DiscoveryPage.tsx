import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, X, RefreshCw, MapPin, Star, Flame, Zap } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import axios from "axios";
import { motion, useMotionValue, useTransform, AnimatePresence, PanInfo } from "framer-motion";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://bpm-social.preview.emergentagent.com";

interface Profile {
  id: string; name: string; age?: number; bio?: string; city?: string;
  interests: string[]; photos: string[]; verified: boolean; premium: boolean;
}

const GRADIENTS = [
  "from-rose-400 to-pink-600",
  "from-violet-400 to-purple-600",
  "from-sky-400 to-blue-600",
  "from-amber-400 to-orange-600",
  "from-teal-400 to-emerald-600"
];

function SwipeCard({
  profile,
  gradient,
  onSwipe,
  isTop,
  stackIndex,
}: {
  profile: Profile;
  gradient: string;
  onSwipe: (dir: "like" | "dislike" | "super_like") => void;
  isTop: boolean;
  stackIndex: number;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-18, 0, 18]);
  const likeOpacity = useTransform(x, [30, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, -30], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const swipeThreshold = 100;
    const velocityThreshold = 500;
    if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
      onSwipe("like");
    } else if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
      onSwipe("dislike");
    }
  };

  const scale = 1 - stackIndex * 0.04;
  const yOffset = stackIndex * 10;

  if (!isTop) {
    return (
      <motion.div
        style={{ scale, y: yOffset, zIndex: 10 - stackIndex }}
        className="absolute inset-0 rounded-3xl overflow-hidden shadow-xl"
      >
        {profile.photos?.[0]
          ? <img src={profile.photos[0]} alt={profile.name} className="w-full h-full object-cover" />
          : <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <span className="text-white text-8xl font-bold opacity-80">{profile.name.charAt(0).toUpperCase()}</span>
            </div>
        }
      </motion.div>
    );
  }

  return (
    <motion.div
      style={{ x, rotate, zIndex: 20 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing select-none"
      whileTap={{ cursor: "grabbing" }}
    >
      {profile.photos?.[0]
        ? <img src={profile.photos[0]} alt={profile.name} className="w-full h-full object-cover pointer-events-none" />
        : <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <span className="text-white text-8xl font-bold opacity-80">{profile.name.charAt(0).toUpperCase()}</span>
          </div>
      }

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

      <motion.div
        style={{ opacity: likeOpacity }}
        className="absolute top-10 left-6 rotate-[-20deg] border-4 border-green-400 rounded-xl px-4 py-2 pointer-events-none"
      >
        <span className="text-green-400 text-2xl font-black">LIKE</span>
      </motion.div>

      <motion.div
        style={{ opacity: nopeOpacity }}
        className="absolute top-10 right-6 rotate-[20deg] border-4 border-red-400 rounded-xl px-4 py-2 pointer-events-none"
      >
        <span className="text-red-400 text-2xl font-black">NOPE</span>
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0 p-5 text-white pointer-events-none">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-2xl font-bold">{profile.name}{profile.age ? `, ${profile.age}` : ""}</h2>
          {profile.verified && <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />}
          {profile.premium && <Flame className="w-5 h-5 text-orange-400 fill-orange-400" />}
        </div>
        {profile.city && (
          <p className="text-sm text-white/80 flex items-center gap-1 mb-2">
            <MapPin className="w-3.5 h-3.5" />{profile.city}
          </p>
        )}
        {profile.bio && <p className="text-sm text-white/90 line-clamp-2">{profile.bio}</p>}
        {profile.interests?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {profile.interests.slice(0, 4).map(i => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-medium backdrop-blur-sm">{i}</span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function DiscoveryPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [matchName, setMatchName] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/discovery/profiles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfiles(data);
      setIdx(0);
    } catch {
      toast.error("Errore nel caricamento");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleSwipe = useCallback(async (dir: "like" | "dislike" | "super_like") => {
    if (!profiles[idx] || swiping) return;
    const profile = profiles[idx];
    setSwiping(true);
    try {
      const { data } = await axios.post(
        `${BACKEND_URL}/api/discovery/swipe`,
        { profile_id: profile.id, direction: dir },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.match) {
        setMatchName(data.other_name || profile.name);
        setMatchId(data.match_id || null);
        setTimeout(() => { setMatchName(null); setMatchId(null); }, 4000);
      }
    } catch { /* ignore */ }
    finally {
      setTimeout(() => { setSwiping(false); setIdx(i => i + 1); }, 200);
    }
  }, [profiles, idx, swiping, token]);

  const current = profiles[idx];
  const next = profiles[idx + 1];
  const hasMore = idx < profiles.length;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">Scopri</h1>
        <p className="text-sm text-gray-500">Trova la tua connessione cardiaca</p>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center h-96 gap-4 px-4">
          <div className="w-full h-80 rounded-3xl bg-gray-200 animate-pulse" />
          <div className="w-48 h-4 rounded bg-gray-200 animate-pulse" />
        </div>
      )}

      {!loading && !hasMore && (
        <div className="flex flex-col items-center justify-center h-80 gap-4 px-8 text-center">
          <div className="w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center">
            <Heart className="w-10 h-10 text-rose-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Hai visto tutti!</h3>
          <p className="text-gray-500 text-sm">Torna più tardi o invita amici per espandere la community</p>
          <Button onClick={fetchProfiles} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" /> Ricarica profili
          </Button>
        </div>
      )}

      {!loading && hasMore && current && (
        <div className="px-4 flex flex-col gap-4">
          <div className="relative h-[420px] mx-auto w-full max-w-sm">
            <AnimatePresence>
              {next && (
                <SwipeCard
                  key={`card-${idx + 1}`}
                  profile={next}
                  gradient={GRADIENTS[(idx + 1) % GRADIENTS.length]}
                  onSwipe={() => {}}
                  isTop={false}
                  stackIndex={1}
                />
              )}
              {profiles[idx + 2] && (
                <SwipeCard
                  key={`card-${idx + 2}`}
                  profile={profiles[idx + 2]}
                  gradient={GRADIENTS[(idx + 2) % GRADIENTS.length]}
                  onSwipe={() => {}}
                  isTop={false}
                  stackIndex={2}
                />
              )}
              <SwipeCard
                key={`card-${idx}`}
                profile={current}
                gradient={GRADIENTS[idx % GRADIENTS.length]}
                onSwipe={handleSwipe}
                isTop={true}
                stackIndex={0}
              />
            </AnimatePresence>
          </div>

          <div className="flex justify-center gap-4 items-center mt-2">
            <button
              onClick={() => handleSwipe("dislike")}
              disabled={swiping}
              className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center border-2 border-gray-200 hover:border-red-400 hover:scale-110 transition-all active:scale-95 disabled:opacity-50"
            >
              <X className="w-6 h-6 text-red-500" />
            </button>
            <button
              onClick={() => handleSwipe("super_like")}
              disabled={swiping}
              className="w-14 h-14 rounded-full bg-blue-500 shadow-xl flex items-center justify-center hover:bg-blue-600 hover:scale-110 transition-all active:scale-95 disabled:opacity-50"
              title="Super Like"
            >
              <Zap className="w-6 h-6 text-white fill-white" />
            </button>
            <button
              onClick={() => handleSwipe("like")}
              disabled={swiping}
              className="w-20 h-20 rounded-full bg-rose-500 shadow-xl flex items-center justify-center hover:bg-rose-600 hover:scale-110 transition-all active:scale-95 disabled:opacity-50"
            >
              <Heart className="w-9 h-9 text-white fill-white" />
            </button>
          </div>
          <p className="text-center text-xs text-gray-400">{profiles.length - idx - 1} profili rimanenti</p>
        </div>
      )}

      <AnimatePresence>
        {matchName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="bg-white rounded-3xl p-8 mx-6 text-center shadow-2xl"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="text-6xl mb-3"
              >
                💕
              </motion.div>
              <h2 className="text-2xl font-black text-rose-600">E un Match!</h2>
              <p className="text-gray-700 mt-2">Tu e <strong>{matchName}</strong> vi siete piaciuti!</p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => { setMatchName(null); setMatchId(null); }} className="flex-1">
                  Continua
                </Button>
                <Button
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"
                  onClick={() => { setMatchName(null); setMatchId(null); navigate(matchId ? `/chat/${matchId}` : "/matches"); }}
                >
                  Scrivi
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

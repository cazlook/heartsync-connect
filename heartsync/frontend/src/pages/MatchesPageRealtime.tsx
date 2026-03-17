import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Star, Flame, MapPin } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://bpm-social.preview.emergentagent.com";

interface OtherUser { id: string; name: string; age?: number; photos: string[]; verified: boolean; city?: string; }
interface Match { id: string; user1_id: string; user2_id: string; cardiac_score: number; matched_at: string; other_user: OtherUser; last_message?: string; }

const GRADIENTS = ["from-rose-400 to-pink-600","from-violet-400 to-purple-600","from-sky-400 to-blue-600","from-amber-400 to-orange-600","from-teal-400 to-emerald-600"];

function MatchSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm animate-pulse">
      <div className="w-16 h-16 rounded-full bg-gray-200 shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="w-32 h-4 bg-gray-200 rounded" />
        <div className="w-48 h-3 bg-gray-200 rounded" />
      </div>
      <div className="w-10 h-10 rounded-full bg-gray-200" />
    </div>
  );
}

export default function MatchesPage() {
  const { token } = useAuth(); const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await axios.get(`${BACKEND_URL}/api/chat/matches`, { headers: { Authorization: `Bearer ${token}` } });
        setMatches(data);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    fetch();
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">Match</h1>
        <p className="text-sm text-gray-500">{loading ? "Caricamento..." : `${matches.length} connessioni cardiache`}</p>
      </div>

      <div className="px-4 flex flex-col gap-3 mt-2">
        {loading && Array.from({length: 4}).map((_, i) => <MatchSkeleton key={i} />)}

        {!loading && matches.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center">
              <Heart className="w-10 h-10 text-rose-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Nessun match ancora</h3>
            <p className="text-gray-500 text-sm">Vai su Scopri e inizia a fare like!</p>
            <Button onClick={() => navigate("/")} className="bg-rose-500 hover:bg-rose-600 text-white">Scopri profili</Button>
          </div>
        )}

        {!loading && matches.map((match, i) => {
          const other = match.other_user;
          const gradient = GRADIENTS[i % GRADIENTS.length];
          const initials = other?.name?.charAt(0).toUpperCase() || "?";
          const timeAgo = match.matched_at ? new Date(match.matched_at).toLocaleDateString("it-IT", { day: "numeric", month: "short" }) : "";

          return (
            <div key={match.id}
              onClick={() => navigate(`/chat/${match.id}`)}
              className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-shadow active:scale-98">
              <div className="relative shrink-0">
                <div className={`w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                  {other?.photos?.[0]
                    ? <img src={other.photos[0]} alt={other.name} className="w-full h-full object-cover" />
                    : <span className="text-white text-2xl font-bold">{initials}</span>
                  }
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center border-2 border-white">
                  <span className="text-xs">{match.cardiac_score}%</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-gray-900 truncate">{other?.name || "Utente"}</span>
                  {other?.verified && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" />}
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {match.last_message || (other?.city ? `📍 ${other.city}` : "Inizia la conversazione!")}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo}</p>
              </div>
              <button className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0 hover:bg-rose-100 transition-colors">
                <MessageCircle className="w-5 h-5 text-rose-500" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

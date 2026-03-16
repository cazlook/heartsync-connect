import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { mockMatches } from "@/lib/mock-data";
import CardiacScoreBadge from "@/components/CardiacScoreBadge";

export default function MatchesPage() {
  const navigate = useNavigate();

  const timeAgo = (date: string) => {
    const h = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
    if (h < 1) return "ora";
    if (h < 24) return `${h}h fa`;
    return `${Math.floor(h / 24)}g fa`;
  };

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 pt-4 pb-2">
        <h1 className="font-display text-xl">Match</h1>
        <p className="text-xs text-muted-foreground mt-1">{mockMatches.length} connessioni cardiache</p>
      </div>

      <div className="px-4 space-y-3">
        {mockMatches.map((match, i) => (
          <motion.button
            key={match.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => navigate(`/chat/${match.id}`)}
            className="w-full glass-panel-hover p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={match.user.photo} alt={match.user.name} className="w-14 h-14 rounded-xl object-cover" />
                <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[10px] font-mono-data font-semibold w-6 h-6 rounded-full flex items-center justify-center">
                  {match.cardiacScore.total}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base">{match.user.name}, {match.user.age}</h3>
                  <span className="text-[10px] text-muted-foreground font-mono-data">{timeAgo(match.matchedAt)}</span>
                </div>
                {match.lastMessage ? (
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{match.lastMessage}</p>
                ) : (
                  <p className="text-sm text-secondary italic mt-0.5">Inizia la conversazione...</p>
                )}
              </div>
            </div>
            <div className="mt-3">
              <CardiacScoreBadge {...match.cardiacScore} size="sm" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Heart, Zap } from "lucide-react";
import { Line, LineChart, XAxis, YAxis, ResponsiveContainer, Bar, BarChart } from "recharts";
import { mockInsights, interestReactionMap, mockMatches } from "@/lib/mock-data";

export default function InsightsPage() {
  const topMatch = mockMatches.reduce((a, b) => (a.cardiacScore.total > b.cardiacScore.total ? a : b));
  const interestData = Object.entries(interestReactionMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, reactions]) => ({ name, reactions }));

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 pt-4 pb-2">
        <h1 className="font-display text-xl">Insights Emotivi</h1>
        <p className="text-xs text-muted-foreground mt-1">Cosa dice il tuo cuore</p>
      </div>

      <div className="px-4 space-y-4">
        {/* Trend 14 giorni */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-secondary" />
            <h3 className="text-sm font-medium">Trend reazioni - 14 giorni</h3>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockInsights}>
                <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v.slice(8)} />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" width={24} />
                <Line type="monotone" dataKey="reactions" stroke="hsl(var(--cardiac-red))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="avgIntensity" stroke="hsl(var(--oxygenated-teal))" strokeWidth={1.5} dot={false} opacity={0.6} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-primary rounded" /> Reazioni</span>
            <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-secondary rounded" /> Intensità media</span>
          </div>
        </motion.div>

        {/* Interessi che scatenano reazioni */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <Heart size={14} className="text-primary" />
            <h3 className="text-sm font-medium">Interessi che accendono il cuore</h3>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={interestData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={70} />
                <Bar dataKey="reactions" fill="hsl(var(--cardiac-red))" radius={[0, 4, 4, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Top match */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-secondary" />
            <h3 className="text-sm font-medium">Connessione cardiaca più forte</h3>
          </div>
          <div className="flex items-center gap-3">
            <img src={topMatch.user.photo} alt={topMatch.user.name} className="w-14 h-14 rounded-xl object-cover" />
            <div className="flex-1">
              <p className="font-display text-base">{topMatch.user.name}, {topMatch.user.age}</p>
              <p className="font-mono-data text-xs text-primary">Score {topMatch.cardiacScore.total}/100</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                La reciprocità più alta tra tutti i tuoi match
              </p>
            </div>
          </div>
        </motion.div>

        {/* AI Insight */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel p-4 border-l-2 border-secondary">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={14} className="text-secondary" />
            <h3 className="text-sm font-medium">Insight personalizzato</h3>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">
            Il tuo cuore reagisce di più a profili con interessi legati alla <span className="text-primary font-medium">musica</span> e al <span className="text-primary font-medium">jazz</span>. 
            Le reazioni più intense avvengono nelle ore serali (21:00-23:00). Potresti trovare connessioni più autentiche partecipando a eventi musicali dal vivo.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

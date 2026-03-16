import { motion } from "framer-motion";
import { Heart, Watch, Search, Zap, Users, Shield, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { mockMatches } from "@/lib/mock-data";

export default function HomePage() {
  const navigate = useNavigate();
  const activeMatches = mockMatches.length;

  const steps = [
    { icon: Watch, title: "Collega il tuo smartwatch", desc: "Connetti il dispositivo per il monitoraggio del battito cardiaco" },
    { icon: Search, title: "Scorri i profili", desc: "Esplora le persone mentre il tuo battito viene monitorato" },
    { icon: Zap, title: "Reazione emotiva", desc: "Il tuo battito aumenta? L'app registra la reazione in modo silenzioso" },
    { icon: Users, title: "Match reciproco", desc: "Se entrambi reagite, nasce un match autentico basato sul cuore" },
  ];

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 pt-6 pb-4">
        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Heart size={18} className="text-primary" />
            </div>
            <div>
              <p className="font-display text-2xl leading-none">{activeMatches}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Match attivi</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-panel p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center">
              <Watch size={18} className="text-secondary" />
            </div>
            <div>
              <p className="font-display text-lg leading-none text-secondary">On</p>
              <p className="text-xs text-muted-foreground mt-0.5">Smartwatch</p>
            </div>
          </motion.div>
        </div>

        {/* CTA Button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => navigate("/")}
          className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 mb-8"
        >
          <Search size={18} />
          Inizia a scoprire
        </motion.button>

        {/* Come funziona */}
        <h2 className="font-display text-lg mb-4">Come funziona</h2>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
              className="glass-panel p-4 flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <step.icon size={16} className="text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Privacy note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 glass-panel p-4 flex items-start gap-3"
        >
          <Shield size={16} className="text-secondary mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold">Privacy garantita</h3>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              I tuoi dati biometrici sono criptati e sotto il tuo pieno controllo. Puoi disattivarli in qualsiasi momento.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

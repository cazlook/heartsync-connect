import { motion } from "framer-motion";
import { Heart, Zap, Shield, Watch, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();

  const features = [
    { icon: Heart, title: "Attrazione Reale", desc: "Il battito cardiaco non mente. Scopri chi ti fa davvero battere il cuore.", color: "text-primary" },
    { icon: Zap, title: "Match Autentici", desc: "Un match nasce solo dalla reciproca reazione fisiologica. Niente tap casuali.", color: "text-secondary" },
    { icon: Watch, title: "Smartwatch Integrato", desc: "Collega il tuo smartwatch e lascia che il corpo parli per te.", color: "text-primary" },
    { icon: Shield, title: "Privacy Totale", desc: "I tuoi dati biometrici sono criptati e sotto il tuo pieno controllo.", color: "text-secondary" },
  ];

  return (
    <div className="min-h-screen pb-20">
      {/* Hero */}
      <div className="px-6 pt-16 pb-10 text-center relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 mb-6"
        >
          <Heart size={36} className="text-primary animate-heartbeat" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="font-display text-4xl leading-tight"
        >
          Ascolta cosa ti dice<br />
          <span className="text-gradient-cardiac">il tuo battito</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-sm text-muted-foreground mt-4 max-w-xs mx-auto leading-relaxed"
        >
          Aura rileva la tua reazione fisiologica reale mentre esplori i profili. I match nascono dal cuore, non da un tap.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          onClick={() => navigate("/")}
          className="mt-8 bg-primary text-primary-foreground px-8 py-3 rounded-xl font-medium text-sm flex items-center gap-2 mx-auto"
        >
          Inizia a Scoprire <ArrowRight size={16} />
        </motion.button>
      </div>

      {/* Features */}
      <div className="px-4 space-y-3">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.1, type: "spring", stiffness: 100, damping: 15 }}
            className="glass-panel p-4 flex items-start gap-3"
          >
            <div className={`mt-0.5 ${f.color}`}>
              <f.icon size={20} />
            </div>
            <div>
              <h3 className="font-display text-sm">{f.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* How it works */}
      <div className="px-4 mt-8">
        <h2 className="font-display text-lg mb-4">Come funziona</h2>
        <div className="space-y-3">
          {[
            { step: "01", text: "Collega il tuo smartwatch e accetta il consenso biometrico" },
            { step: "02", text: "Scorri i profili — il tuo battito viene monitorato in tempo reale" },
            { step: "03", text: "Se il cuore reagisce, la reazione viene registrata silenziosamente" },
            { step: "04", text: "Quando la reazione è reciproca, nasce un match autentico" },
          ].map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + i * 0.1 }}
              className="flex items-center gap-3"
            >
              <span className="font-mono-data text-xs text-primary/60">{s.step}</span>
              <p className="text-sm text-foreground/80">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { Heart } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  bpm: number;
  isReacting: boolean;
  intensity: "low" | "medium" | "high";
  compact?: boolean;
}

export default function HeartRateDisplay({ bpm, isReacting, intensity, compact }: Props) {
  const glowColor = isReacting
    ? intensity === "high" ? "shadow-[0_0_30px_hsl(var(--cardiac-red)/0.6)]"
      : intensity === "medium" ? "shadow-[0_0_20px_hsl(var(--cardiac-red)/0.4)]"
      : "shadow-[0_0_12px_hsl(var(--cardiac-red)/0.25)]"
    : "";

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 font-mono-data text-xs ${isReacting ? "text-primary" : "text-muted-foreground"}`}>
        <Heart size={12} className={isReacting ? "animate-heartbeat text-primary fill-primary" : ""} />
        <span>{bpm}</span>
      </div>
    );
  }

  return (
    <motion.div
      className={`glass-panel px-4 py-2 flex items-center gap-3 ${glowColor} transition-shadow duration-500`}
      animate={isReacting ? { scale: [1, 1.02, 1] } : {}}
      transition={{ repeat: Infinity, duration: 1.2 }}
    >
      <Heart
        size={24}
        className={`transition-colors duration-300 ${
          isReacting ? "text-primary fill-primary animate-heartbeat" : "text-muted-foreground"
        }`}
      />
      <div>
        <div className="font-mono-data text-2xl font-medium leading-none">
          <span className={isReacting ? "text-primary" : "text-foreground"}>{bpm}</span>
          <span className="text-muted-foreground text-sm ml-1">BPM</span>
        </div>
        {isReacting && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[10px] text-primary/80 mt-0.5"
          >
            Reazione {intensity === "high" ? "intensa" : intensity === "medium" ? "significativa" : "lieve"} rilevata
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}

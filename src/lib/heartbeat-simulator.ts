import { useState, useEffect, useCallback, useRef } from "react";

const BASE_BPM = 72;
const REACTION_THRESHOLD = 12; // +12 BPM = reaction

export function useHeartbeatSimulator() {
  const [bpm, setBpm] = useState(BASE_BPM);
  const [isReacting, setIsReacting] = useState(false);
  const [reactionIntensity, setReactionIntensity] = useState<"low" | "medium" | "high">("low");
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const targetBpmRef = useRef(BASE_BPM);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setBpm((prev) => {
        const noise = (Math.random() - 0.5) * 4;
        const target = targetBpmRef.current;
        const next = prev + (target - prev) * 0.15 + noise;
        const clamped = Math.max(58, Math.min(140, Math.round(next)));
        const delta = clamped - BASE_BPM;

        if (delta >= REACTION_THRESHOLD) {
          setIsReacting(true);
          if (delta >= 25) setReactionIntensity("high");
          else if (delta >= 18) setReactionIntensity("medium");
          else setReactionIntensity("low");
        } else {
          setIsReacting(false);
          setReactionIntensity("low");
        }

        return clamped;
      });
    }, 800);

    return () => clearInterval(intervalRef.current);
  }, []);

  const simulateReaction = useCallback((intensity: "low" | "medium" | "high" = "medium") => {
    const delta = intensity === "high" ? 30 : intensity === "medium" ? 20 : 14;
    targetBpmRef.current = BASE_BPM + delta;
    setTimeout(() => {
      targetBpmRef.current = BASE_BPM;
    }, 4000);
  }, []);

  const triggerRandomReaction = useCallback(() => {
    if (Math.random() > 0.6) {
      const intensities: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];
      simulateReaction(intensities[Math.floor(Math.random() * 3)]);
    }
  }, [simulateReaction]);

  return { bpm, isReacting, reactionIntensity, simulateReaction, triggerRandomReaction };
}

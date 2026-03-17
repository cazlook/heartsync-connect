import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ProfileReaction {
  profile_id: string;
  bpm_delta: number;
  timestamp: number;
}

interface HeartRateContextType {
  baselineBpm: number | null;
  setBaseline: (bpm: number) => Promise<void>;
  profileReactions: ProfileReaction[];
  addProfileReaction: (profile_id: string, bpm_delta: number) => void;
  getReactionForProfile: (profile_id: string) => ProfileReaction | undefined;
  calculateMatchBonus: (profile_id: string) => number;
}

const HeartRateContext = createContext<HeartRateContextType | null>(null);

const BASELINE_KEY = "heartsync_baseline_bpm";

export function HeartRateProvider({ children }: { children: ReactNode }) {
  const [baselineBpm, setBaselineBpmState] = useState<number | null>(null);
  const [profileReactions, setProfileReactions] = useState<ProfileReaction[]>([]);

  React.useEffect(() => {
    AsyncStorage.getItem(BASELINE_KEY).then((val) => {
      if (val) setBaselineBpmState(Number(val));
    });
  }, []);

  const setBaseline = useCallback(async (bpm: number) => {
    setBaselineBpmState(bpm);
    await AsyncStorage.setItem(BASELINE_KEY, String(bpm));
  }, []);

  const addProfileReaction = useCallback((profile_id: string, bpm_delta: number) => {
    setProfileReactions((prev) => [
      ...prev.filter((r) => r.profile_id !== profile_id),
      { profile_id, bpm_delta, timestamp: Date.now() },
    ]);
  }, []);

  const getReactionForProfile = useCallback(
    (profile_id: string) => profileReactions.find((r) => r.profile_id === profile_id),
    [profileReactions]
  );

  /**
   * Calcola il bonus di punteggio basato sulla variazione cardiaca.
   *
   * Formula:
   *   delta_pct = (bpm_delta / baseline) * 100
   *   bonus = min(delta_pct * 1.5, 40)
   *
   * Esempio: baseline 68, delta +14 → delta_pct ≈ 20.5% → bonus ≈ 30 punti
   */
  const calculateMatchBonus = useCallback(
    (profile_id: string): number => {
      const reaction = profileReactions.find((r) => r.profile_id === profile_id);
      if (!reaction || !baselineBpm || baselineBpm === 0) return 0;
      const deltaPct = (reaction.bpm_delta / baselineBpm) * 100;
      return Math.min(Math.round(deltaPct * 1.5), 40);
    },
    [profileReactions, baselineBpm]
  );

  return (
    <HeartRateContext.Provider
      value={{ baselineBpm, setBaseline, profileReactions, addProfileReaction, getReactionForProfile, calculateMatchBonus }}
    >
      {children}
    </HeartRateContext.Provider>
  );
}

export function useHeartRate() {
  const ctx = useContext(HeartRateContext);
  if (!ctx) throw new Error("useHeartRate must be used inside HeartRateProvider");
  return ctx;
}

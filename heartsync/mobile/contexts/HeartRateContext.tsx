import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ProfileReaction {
  profile_id: string;
  bpm_delta: number;
  timestamp: number;
}

export interface HeartRateContextType {
  baselineBpm: number | null;
  currentBpm: number | null;
  isMonitoring: boolean;
  setBaseline: (bpm: number) => Promise<void>;
  setCurrentBpm: (bpm: number) => void;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  profileReactions: ProfileReaction[];
  addProfileReaction: (profile_id: string, bpm_delta: number) => void;
  getReactionForProfile: (profile_id: string) => ProfileReaction | undefined;
  calculateMatchBonus: (profile_id: string) => number;
  getBpmDelta: () => number;
}

const HeartRateContext = createContext<HeartRateContextType | null>(null);

const BASELINE_KEY = "synclove_baseline_bpm";

export function HeartRateProvider({ children }: { children: ReactNode }) {
  const [baselineBpm, setBaselineBpmState] = useState<number | null>(null);
  const [currentBpm, setCurrentBpmState] = useState<number | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [profileReactions, setProfileReactions] = useState<ProfileReaction[]>([]);
  const monitorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem(BASELINE_KEY).then((val) => {
      if (val) setBaselineBpmState(Number(val));
    });
  }, []);

  const setBaseline = useCallback(async (bpm: number) => {
    setBaselineBpmState(bpm);
    await AsyncStorage.setItem(BASELINE_KEY, String(bpm));
  }, []);

  const setCurrentBpm = useCallback((bpm: number) => {
    setCurrentBpmState(bpm);
  }, []);

  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
  }, []);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }
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

  const getBpmDelta = useCallback((): number => {
    if (!currentBpm || !baselineBpm) return 0;
    return currentBpm - baselineBpm;
  }, [currentBpm, baselineBpm]);

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
      value={{
        baselineBpm,
        currentBpm,
        isMonitoring,
        setBaseline,
        setCurrentBpm,
        startMonitoring,
        stopMonitoring,
        profileReactions,
        addProfileReaction,
        getReactionForProfile,
        calculateMatchBonus,
        getBpmDelta,
      }}
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

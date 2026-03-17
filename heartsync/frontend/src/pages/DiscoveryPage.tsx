import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { mockProfiles, type UserProfile, type EmotionalReaction } from "@/lib/mock-data";
import { useHeartbeatSimulator } from "@/lib/heartbeat-simulator";
import HeartRateDisplay from "@/components/HeartRateDisplay";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://bpm-social.preview.emergentagent.com';

export default function DiscoveryPage() {
  const { token } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reactions, setReactions] = useState<EmotionalReaction[]>([]);
  const [direction, setDirection] = useState(0);
  const { bpm, isReacting, reactionIntensity, triggerRandomReaction } = useHeartbeatSimulator();
  const lastBpmRef = useRef(72);
  const lastSavedBpmRef = useRef(Date.now());

  const profile = mockProfiles[currentIndex];

  // Save heart rate reading periodically
  useEffect(() => {
    if (!token) return;
    
    const saveHeartRate = async () => {
      // Save every 5 seconds
      const now = Date.now();
      if (now - lastSavedBpmRef.current > 5000) {
        try {
          await axios.post(
            `${BACKEND_URL}/api/biometrics/heartrate`,
            { bpm, context: 'browsing' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          lastSavedBpmRef.current = now;
        } catch (error) {
          // Silently fail
        }
      }
    };
    
    const interval = setInterval(saveHeartRate, 5000);
    return () => clearInterval(interval);
  }, [bpm, token]);

  const goNext = () => {
    if (currentIndex < mockProfiles.length - 1) {
      setDirection(1);
      setCurrentIndex((i) => i + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((i) => i - 1);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => triggerRandomReaction(), 1500 + Math.random() * 2000);
    return () => clearTimeout(timer);
  }, [currentIndex, triggerRandomReaction]);

  useEffect(() => {
    if (isReacting && token) {
      // Save reaction to backend
      const saveReaction = async () => {
        try {
          await axios.post(
            `${BACKEND_URL}/api/biometrics/reaction`,
            {
              profile_id: profile.id,
              profile_name: profile.name,
              bpm_before: lastBpmRef.current,
              bpm_peak: bpm,
              bpm_delta: bpm - lastBpmRef.current,
              intensity: reactionIntensity
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (error) {
          // Silently fail
        }
      };
      
      saveReaction();
      lastBpmRef.current = bpm;
      
      setReactions((prev) => {
        if (prev.find((r) => r.profileId === profile.id)) return prev;
        return [...prev, {
          profileId: profile.id,
          bpmDelta: bpm - 72,
          timestamp: new Date().toISOString(),
          intensity: reactionIntensity,
        }];
      });
    }
  }, [isReacting, profile.id, bpm, reactionIntensity, token]);

  const hasReacted = reactions.some((r) => r.profileId === profile.id);

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="font-display text-xl">Scopri</h1>
        <HeartRateDisplay bpm={bpm} isReacting={isReacting} intensity={reactionIntensity} compact />
      </div>

      {/* Profile Card */}
      <div className="px-4 relative">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={profile.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 100 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="relative rounded-2xl overflow-hidden aspect-[3/4]"
          >
            <img
              src={profile.photo}
              alt={profile.name}
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

            {/* Cardiac glow edges when reacting */}
            {isReacting && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  boxShadow: `inset 0 0 60px hsl(var(--cardiac-red) / ${
                    reactionIntensity === "high" ? 0.4 : reactionIntensity === "medium" ? 0.25 : 0.15
                  })`,
                }}
              />
            )}

            {/* Profile Info */}
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="font-display text-3xl text-foreground">
                    {profile.name}, {profile.age}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">{profile.city}</p>
                  <p className="text-sm text-foreground/80 mt-2 line-clamp-2">{profile.bio}</p>
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {profile.interests.map((interest) => (
                      <span key={interest} className="glass-panel text-[11px] px-2.5 py-1 text-muted-foreground">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
                {hasReacted && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="glass-panel p-2 cardiac-glow"
                  >
                    <Heart size={20} className="text-primary fill-primary animate-heartbeat" />
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-4">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="glass-panel p-3 disabled:opacity-30"
          >
            <ChevronLeft size={20} className="text-muted-foreground" />
          </button>

          {/* BPM Display */}
          <HeartRateDisplay bpm={bpm} isReacting={isReacting} intensity={reactionIntensity} />

          <button
            onClick={goNext}
            disabled={currentIndex === mockProfiles.length - 1}
            className="glass-panel p-3 disabled:opacity-30"
          >
            <ChevronRight size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Counter */}
        <p className="text-center text-muted-foreground text-xs mt-3 font-mono-data">
          {currentIndex + 1} / {mockProfiles.length} profili · {reactions.length} reazioni registrate
        </p>
      </div>
    </div>
  );
}

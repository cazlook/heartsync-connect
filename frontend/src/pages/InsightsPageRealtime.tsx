import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Heart, TrendingUp, Calendar, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;

interface BiometricStats {
  total_readings: number;
  avg_bpm: number;
  max_bpm: number;
  min_bpm: number;
  total_reactions: number;
  avg_reaction_intensity: number;
  most_reactive_time: string | null;
}

interface TopReaction {
  profile_id: string;
  profile_name: string;
  bpm_delta: number;
  intensity: string;
  timestamp: string;
  reaction_count: number;
}

export default function InsightsPageRealtime() {
  const { token } = useAuth();
  const [stats, setStats] = useState<BiometricStats | null>(null);
  const [topReactions, setTopReactions] = useState<TopReaction[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7); // days

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, timeRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load stats
      const statsRes = await axios.get(`${BACKEND_URL}/api/biometrics/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(statsRes.data);
      
      // Load top reactions
      const reactionsRes = await axios.get(`${BACKEND_URL}/api/biometrics/top-reactions`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 5 }
      });
      setTopReactions(reactionsRes.data);
      
      // Load timeline
      const timelineRes = await axios.get(`${BACKEND_URL}/api/biometrics/timeline`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { days: timeRange }
      });
      
      // Format timeline for chart
      const formattedTimeline = timelineRes.data.timeline.map((item: any) => ({
        time: new Date(item.timestamp).toLocaleDateString('it-IT', { month: 'short', day: 'numeric' }),
        bpm: item.bpm,
        fullDate: item.timestamp
      }));
      setTimeline(formattedTimeline);
      
    } catch (error) {
      console.error('Error loading biometric data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-secondary';
      case 'low': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  const getIntensityEmoji = (intensity: string) => {
    switch (intensity) {
      case 'high': return '🔥';
      case 'medium': return '💓';
      case 'low': return '💙';
      default: return '💚';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="animate-pulse text-primary">Caricamento statistiche...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="font-display text-xl">Dashboard BPM</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Le tue statistiche cardiache
        </p>
      </div>

      {/* Stats Grid */}
      <div className="px-4 grid grid-cols-2 gap-3 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity size={16} className="text-primary" />
            <span className="text-xs text-muted-foreground">BPM Medio</span>
          </div>
          <p className="font-display text-3xl text-primary">
            {stats?.avg_bpm || 0}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-panel p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Heart size={16} className="text-destructive" />
            <span className="text-xs text-muted-foreground">Max BPM</span>
          </div>
          <p className="font-display text-3xl text-destructive">
            {stats?.max_bpm || 0}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-secondary" />
            <span className="text-xs text-muted-foreground">Reazioni</span>
          </div>
          <p className="font-display text-3xl text-secondary">
            {stats?.total_reactions || 0}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-panel p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-accent" />
            <span className="text-xs text-muted-foreground">Letture</span>
          </div>
          <p className="font-display text-3xl text-accent">
            {stats?.total_readings || 0}
          </p>
        </motion.div>
      </div>

      {/* BPM Timeline Chart */}
      {timeline.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="px-4 mb-6"
        >
          <div className="glass-panel p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-sm">Andamento BPM</h2>
              <div className="flex gap-2">
                {[7, 14, 30].map((days) => (
                  <button
                    key={days}
                    onClick={() => setTimeRange(days)}
                    className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                      timeRange === days
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {days}g
                  </button>
                ))}
              </div>
            </div>
            
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                  stroke="rgba(255,255,255,0.2)"
                />
                <YAxis 
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                  stroke="rgba(255,255,255,0.2)"
                  domain={['dataMin - 10', 'dataMax + 10']}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="bpm" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Top Reactions - Momenti più intensi */}
      {topReactions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="px-4 mb-6"
        >
          <div className="glass-panel p-4">
            <h2 className="font-display text-sm mb-3">Momenti più intensi 🔥</h2>
            <div className="space-y-2">
              {topReactions.map((reaction, index) => (
                <div
                  key={reaction.profile_id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                    <User size={14} className="text-primary" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {reaction.profile_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reaction.reaction_count > 1 ? `${reaction.reaction_count} reazioni` : '1 reazione'}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className={`text-sm font-bold ${getIntensityColor(reaction.intensity)}`}>
                      +{reaction.bpm_delta} {getIntensityEmoji(reaction.intensity)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(reaction.timestamp), { addSuffix: true, locale: it })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {stats && stats.total_readings === 0 && (
        <div className="px-4 text-center py-12">
          <Activity size={48} className="mx-auto text-muted-foreground opacity-50 mb-4" />
          <p className="text-muted-foreground text-sm">
            Nessun dato biometrico ancora
          </p>
          <p className="text-muted-foreground text-xs mt-2">
            Inizia a scorrere i profili per raccogliere dati!
          </p>
        </div>
      )}
    </div>
  );
}

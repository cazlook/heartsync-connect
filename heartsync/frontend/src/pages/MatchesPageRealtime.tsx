import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle, Heart, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://bpm-social.preview.emergentagent.com';

interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  cardiac_score: number;
  matched_at: string;
}

export default function MatchesPageRealtime() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    
    const loadMatches = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/chat/matches`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMatches(response.data);
      } catch (error) {
        console.error('Error loading matches:', error);
        toast.error('Errore nel caricamento dei match');
      } finally {
        setLoading(false);
      }
    };
    
    loadMatches();
  }, [token]);

  const createTestMatch = async () => {
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/chat/create-test-match`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMatches(prev => [...prev, response.data]);
      toast.success('Match di test creato!');
    } catch (error) {
      console.error('Error creating test match:', error);
      toast.error('Errore nella creazione del match');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="animate-pulse text-primary">Caricamento match...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="font-display text-xl">I tuoi Match</h1>
        <Button 
          onClick={createTestMatch}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          <Plus size={14} />
          Test Match
        </Button>
      </div>

      {/* Matches List */}
      <div className="px-4 space-y-3 mt-4">
        {matches.length === 0 && (
          <div className="text-center py-12">
            <Heart size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-sm">
              Nessun match ancora
            </p>
            <p className="text-muted-foreground text-xs mt-2">
              Clicca su "Test Match" per creare un match di prova
            </p>
          </div>
        )}

        {matches.map((match, index) => (
          <motion.div
            key={match.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => navigate(`/chat/${match.id}`)}
            className="glass-panel p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <Heart size={20} className="text-primary fill-primary" />
            </div>
            
            <div className="flex-1">
              <h3 className="font-display text-sm">Match</h3>
              <p className="text-xs text-muted-foreground">
                Score cardiaco: {match.cardiac_score}
              </p>
            </div>
            
            <MessageCircle size={18} className="text-muted-foreground" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

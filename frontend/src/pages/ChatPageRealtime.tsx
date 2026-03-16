import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Smile, Image as ImageIcon, Heart } from "lucide-react";
import { useSocket } from "@/contexts/SocketContext";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;

interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  message: string;
  message_type: string;
  timestamp: string;
  read: boolean;
  reactions: Array<{
    user_id: string;
    reaction: string;
  }>;
}

interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  cardiac_score: number;
  matched_at: string;
}

export default function ChatPageRealtime() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { connected, joinMatch, leaveMatch, sendMessage, addReaction, messages: socketMessages } = useSocket();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [match, setMatch] = useState<Match | null>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load match and messages on mount
  useEffect(() => {
    if (!matchId || !token) return;
    
    const loadData = async () => {
      try {
        // Load match history from REST API
        const response = await axios.get(`${BACKEND_URL}/api/chat/${matchId}/messages`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setMessages(response.data.reverse());
        setLoading(false);
      } catch (error: any) {
        console.error('Error loading messages:', error);
        toast.error('Errore nel caricamento della chat');
        setLoading(false);
      }
    };
    
    loadData();
    
    // Join socket room
    if (connected) {
      joinMatch(matchId);
    }
    
    return () => {
      if (matchId) {
        leaveMatch(matchId);
      }
    };
  }, [matchId, token, connected]);

  // Update messages when socket receives new ones
  useEffect(() => {
    if (matchId && socketMessages.has(matchId)) {
      const newMessages = socketMessages.get(matchId) || [];
      // Merge with existing messages, avoiding duplicates
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const toAdd = newMessages.filter(m => !existingIds.has(m.id));
        return [...prev, ...toAdd];
      });
    }
  }, [socketMessages, matchId]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !matchId) return;
    
    sendMessage(matchId, input.trim(), 'text');
    setInput("");
  };

  const handleReaction = (messageId: string, reaction: string) => {
    if (!matchId) return;
    addReaction(matchId, messageId, reaction);
    setShowReactionPicker(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary">Caricamento chat...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="glass-panel rounded-none border-b border-border/50 px-3 py-3 flex items-center gap-3 z-10">
        <button onClick={() => navigate("/matches")} className="p-1">
          <ArrowLeft size={20} className="text-muted-foreground" />
        </button>
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
          <Heart size={18} className="text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-sm">Match</h2>
          <span className="font-mono-data text-[10px] text-secondary">
            {connected ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Nessun messaggio ancora. Inizia la conversazione! 💬
          </div>
        )}
        
        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div className="relative group">
                <div
                  className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "glass-panel rounded-bl-md"
                  }`}
                >
                  {msg.message}
                  
                  {/* Reactions */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {msg.reactions.map((reaction, idx) => (
                        <span key={idx} className="text-xs">
                          {reaction.reaction}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Reaction button */}
                <button
                  onClick={() => setShowReactionPicker(msg.id)}
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-muted rounded-full p-1"
                >
                  <Smile size={14} />
                </button>
                
                {/* Reaction picker */}
                {showReactionPicker === msg.id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute -bottom-10 left-1/2 -translate-x-1/2 glass-panel p-2 flex gap-2 z-20"
                  >
                    {['❤️', '😍', '😂', '😮', '😢', '👍'].map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(msg.id, emoji)}
                        className="hover:scale-125 transition-transform"
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Input */}
      <div className="glass-panel rounded-none border-t border-border/50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-muted/50 rounded-lg transition-colors">
            <ImageIcon size={18} className="text-muted-foreground" />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Scrivi un messaggio..."
            className="flex-1 bg-muted/50 border-none rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !connected}
            className="bg-primary text-primary-foreground p-2.5 rounded-xl disabled:opacity-30 transition-opacity"
          >
            <Send size={16} />
          </button>
        </div>
        {!connected && (
          <p className="text-xs text-destructive mt-2 text-center">
            Connessione persa. Riconnessione in corso...
          </p>
        )}
      </div>
    </div>
  );
}

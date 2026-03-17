import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Smile, Heart, Phone, MoreVertical } from "lucide-react";
import { useSocket } from "@/contexts/SocketContext";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://bpm-social.preview.emergentagent.com';

const GRADIENTS = [
  "from-rose-400 to-pink-600",
  "from-violet-400 to-purple-600",
  "from-sky-400 to-blue-600",
];

interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  message: string;
  message_type: string;
  timestamp: string;
  read: boolean;
  reactions: Array<{ user_id: string; reaction: string }>;
}

interface OtherUser {
  id: string;
  name: string;
  photos: string[];
  verified: boolean;
  city?: string;
}

interface MatchInfo {
  id: string;
  cardiac_score: number;
  other_user: OtherUser;
}

const QUICK_REPLIES = ["Ciao! 👋", "Come stai?", "Sei bellissimo/a!", "Usciamo?", "Raccontami di te"];

export default function ChatPageRealtime() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { connected, joinMatch, leaveMatch, sendMessage, addReaction, markRead, messages: socketMessages } = useSocket();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [typing, setTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!matchId || !token) return;

    const loadData = async () => {
      try {
        const [messagesRes, matchesRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/chat/${matchId}/messages`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${BACKEND_URL}/api/chat/matches`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        setMessages(messagesRes.data.reverse());

        const found = matchesRes.data.find((m: MatchInfo) => m.id === matchId);
        if (found) setMatchInfo(found);
      } catch {
        toast.error('Errore nel caricamento della chat');
      } finally {
        setLoading(false);
      }
    };

    loadData();

    if (connected) {
      joinMatch(matchId);
      markRead(matchId);
    }

    return () => {
      if (matchId) leaveMatch(matchId);
    };
  }, [matchId, token, connected]);

  useEffect(() => {
    if (matchId && socketMessages.has(matchId)) {
      const newMessages = socketMessages.get(matchId) || [];
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const toAdd = newMessages.filter(m => !existingIds.has(m.id));
        return [...prev, ...toAdd];
      });
    }
  }, [socketMessages, matchId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || !matchId) return;
    if (!connected) {
      axios.post(`${BACKEND_URL}/api/chat/${matchId}/messages`,
        { message: msg, message_type: 'text' },
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(({ data }) => {
        setMessages(prev => [...prev, data]);
      }).catch(() => toast.error('Errore invio messaggio'));
    } else {
      sendMessage(matchId, msg, 'text');
    }
    setInput("");
    setShowQuickReplies(false);
  };

  const handleReaction = (messageId: string, reaction: string) => {
    if (!matchId) return;
    addReaction(matchId, messageId, reaction);
    setShowReactionPicker(null);
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 2000);
  };

  const otherUser = matchInfo?.other_user;
  const gradientClass = GRADIENTS[0];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse" />
          <div className="w-32 h-4 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 z-10 shadow-sm">
        <button onClick={() => navigate("/matches")} className="p-1.5 -ml-1 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>

        <div className="relative shrink-0">
          {otherUser?.photos?.[0]
            ? <img src={otherUser.photos[0]} alt={otherUser.name} className="w-10 h-10 rounded-full object-cover" />
            : <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center`}>
                <span className="text-white font-bold text-sm">{otherUser?.name?.charAt(0).toUpperCase() || "?"}</span>
              </div>
          }
          {connected && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 text-sm truncate">{otherUser?.name || "Match"}</h2>
          <p className="text-[11px] text-gray-400">{connected ? "Online" : "Offline"} {matchInfo ? `• ${matchInfo.cardiac_score}% compatibilità` : ""}</p>
        </div>

        <div className="flex items-center gap-1">
          <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <MoreVertical size={18} className="text-gray-500" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💕</div>
            <p className="text-gray-500 text-sm font-medium">Hai un nuovo match con {otherUser?.name || "qualcuno"}!</p>
            <p className="text-gray-400 text-xs mt-1">Inizia la conversazione</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.sender_id === user?.id;
          const showTime = i === 0 || (new Date(msg.timestamp).getTime() - new Date(messages[i - 1].timestamp).getTime()) > 5 * 60 * 1000;

          return (
            <div key={msg.id}>
              {showTime && (
                <div className="text-center text-[10px] text-gray-400 my-2">
                  {new Date(msg.timestamp).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div className="relative group max-w-[75%]">
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? "bg-rose-500 text-white rounded-br-sm"
                      : "bg-white text-gray-900 rounded-bl-sm shadow-sm"
                  }`}>
                    {msg.message}
                  </div>

                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className={`flex gap-0.5 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
                      {msg.reactions.map((r, idx) => (
                        <span key={idx} className="text-base">{r.reaction}</span>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                    className={`absolute -bottom-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-md rounded-full p-1 ${isMe ? "right-2" : "left-2"}`}
                  >
                    <Smile size={12} className="text-gray-500" />
                  </button>

                  <AnimatePresence>
                    {showReactionPicker === msg.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 4 }}
                        className={`absolute -bottom-10 z-20 bg-white shadow-xl rounded-2xl px-2 py-1.5 flex gap-2 border border-gray-100 ${isMe ? "right-0" : "left-0"}`}
                      >
                        {['❤️', '😍', '😂', '😮', '😢', '👍'].map(emoji => (
                          <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} className="hover:scale-125 transition-transform text-lg">
                            {emoji}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {showQuickReplies && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border-t border-gray-100 px-4 py-2"
          >
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {QUICK_REPLIES.map(r => (
                <button
                  key={r}
                  onClick={() => handleSend(r)}
                  className="shrink-0 px-3 py-1.5 rounded-full bg-rose-50 text-rose-600 text-xs font-medium border border-rose-200 hover:bg-rose-100 transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white border-t border-gray-100 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQuickReplies(!showQuickReplies)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <Heart size={18} className={showQuickReplies ? "text-rose-500" : "text-gray-400"} />
          </button>
          <input
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Scrivi un messaggio..."
            className="flex-1 bg-gray-100 border-none rounded-full px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-300 transition-all"
          />
          <motion.button
            onClick={() => handleSend()}
            disabled={!input.trim()}
            whileTap={{ scale: 0.9 }}
            className="bg-rose-500 text-white p-2.5 rounded-full disabled:opacity-30 transition-opacity hover:bg-rose-600 shadow-sm"
          >
            <Send size={16} />
          </motion.button>
        </div>
        {!connected && (
          <p className="text-xs text-red-400 mt-2 text-center">Riconnessione in corso...</p>
        )}
      </div>
    </div>
  );
}

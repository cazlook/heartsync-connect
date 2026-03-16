import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Sparkles, ChevronDown } from "lucide-react";
import { mockMatches, mockChatMessages, conversationStarters, type ChatMessage } from "@/lib/mock-data";
import CardiacScoreBadge from "@/components/CardiacScoreBadge";

export default function ChatPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const match = mockMatches.find((m) => m.id === matchId);
  const [messages, setMessages] = useState<ChatMessage[]>(mockChatMessages[matchId || ""] || []);
  const [input, setInput] = useState("");
  const [showStarters, setShowStarters] = useState(messages.length === 0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  if (!match) return null;

  const commonInterest = match.user.interests[0];
  const starters = conversationStarters.map((s) =>
    s.replace("{interest}", commonInterest).replace("{score}", String(match.cardiacScore.total))
  );

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: `u${Date.now()}`, senderId: "me", text: text.trim(), timestamp: new Date().toISOString() },
    ]);
    setInput("");
    setShowStarters(false);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="glass-panel rounded-none border-b border-border/50 px-3 py-3 flex items-center gap-3 z-10">
        <button onClick={() => navigate("/matches")} className="p-1">
          <ArrowLeft size={20} className="text-muted-foreground" />
        </button>
        <img src={match.user.photo} alt={match.user.name} className="w-9 h-9 rounded-lg object-cover" />
        <div className="flex-1">
          <h2 className="font-display text-sm">{match.user.name}</h2>
          <span className="font-mono-data text-[10px] text-primary">Score {match.cardiacScore.total}</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-4 space-y-3">
        {/* Cardiac Score Summary */}
        <div className="mb-4">
          <CardiacScoreBadge {...match.cardiacScore} size="sm" />
        </div>

        {/* AI Starters */}
        <AnimatePresence>
          {showStarters && messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-panel p-3 space-y-2"
            >
              <button
                onClick={() => setShowStarters(false)}
                className="flex items-center gap-1.5 text-xs text-secondary w-full"
              >
                <Sparkles size={12} />
                <span className="flex-1 text-left">Spunti per rompere il ghiaccio</span>
                <ChevronDown size={12} />
              </button>
              {starters.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(s); }}
                  className="w-full text-left text-xs text-foreground/80 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                >
                  {s}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.senderId === "me" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${
                msg.senderId === "me"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "glass-panel rounded-bl-md"
              }`}
            >
              {msg.text}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Input */}
      <div className="glass-panel rounded-none border-t border-border/50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          {messages.length === 0 && !showStarters && (
            <button onClick={() => setShowStarters(true)} className="p-2">
              <Sparkles size={18} className="text-secondary" />
            </button>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Scrivi un messaggio..."
            className="flex-1 bg-muted/50 border-none rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim()}
            className="bg-primary text-primary-foreground p-2.5 rounded-xl disabled:opacity-30 transition-opacity"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

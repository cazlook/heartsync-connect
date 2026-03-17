import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Watch, Database, Download, Trash2, Eye, EyeOff, ChevronRight, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [showReactions, setShowReactions] = useState(true);

  const handleLogout = () => {
    logout();
    toast.success('Disconnesso con successo');
  };

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 pt-4 pb-2">
        <h1 className="font-display text-xl">Impostazioni</h1>
        {user && (
          <p className="text-sm text-muted-foreground mt-1">
            {user.name} · {user.email}
          </p>
        )}
      </div>

      <div className="px-4 space-y-4">{/* Smartwatch */}
        {/* Smartwatch */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <Watch size={16} className="text-secondary" />
            <h3 className="text-sm font-medium">Smartwatch</h3>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm">Apple Watch Series 9</span>
            <span className="text-xs text-secondary font-mono-data">Connesso</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Frequenza campionamento: 1 Hz · Batteria smartwatch: 72%</p>
        </motion.div>

        {/* Privacy */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className="text-primary" />
            <h3 className="text-sm font-medium">Privacy & Biometria</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Rilevamento biometrico</p>
                <p className="text-[11px] text-muted-foreground">Monitora il battito durante la scoperta</p>
              </div>
              <button
                onClick={() => setBiometricsEnabled(!biometricsEnabled)}
                className={`w-11 h-6 rounded-full transition-colors ${biometricsEnabled ? "bg-primary" : "bg-muted"}`}
              >
                <div className={`w-5 h-5 rounded-full bg-foreground transition-transform ${biometricsEnabled ? "translate-x-5.5" : "translate-x-0.5"}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Mostra reazioni</p>
                <p className="text-[11px] text-muted-foreground">Gli altri vedono se hai reagito</p>
              </div>
              <button
                onClick={() => setShowReactions(!showReactions)}
                className="p-1.5"
              >
                {showReactions ? <Eye size={18} className="text-secondary" /> : <EyeOff size={18} className="text-muted-foreground" />}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Dati */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database size={16} className="text-muted-foreground" />
            <h3 className="text-sm font-medium">I tuoi dati</h3>
          </div>

          <div className="space-y-1">
            <button className="flex items-center justify-between w-full py-2.5 text-sm group">
              <span className="flex items-center gap-2">
                <Download size={14} className="text-muted-foreground" /> Esporta i tuoi dati
              </span>
              <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
            <button className="flex items-center justify-between w-full py-2.5 text-sm text-destructive group">
              <span className="flex items-center gap-2">
                <Trash2 size={14} /> Cancella tutti i dati biometrici
              </span>
              <ChevronRight size={14} className="group-hover:text-destructive transition-colors" />
            </button>
            <button className="flex items-center justify-between w-full py-2.5 text-sm text-destructive group">
              <span className="flex items-center gap-2">
                <Trash2 size={14} /> Elimina account
              </span>
              <ChevronRight size={14} className="group-hover:text-destructive transition-colors" />
            </button>
          </div>
        </motion.div>

        {/* Account */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.20 }} className="glass-panel p-4">
          <button 
            onClick={handleLogout}
            className="flex items-center justify-between w-full py-2.5 text-sm text-destructive group"
          >
            <span className="flex items-center gap-2">
              <LogOut size={14} /> Disconnetti
            </span>
            <ChevronRight size={14} className="group-hover:text-destructive transition-colors" />
          </button>
        </motion.div>

        {/* Legal */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="glass-panel p-4 space-y-2">
          <button className="flex items-center justify-between w-full py-1 text-sm text-muted-foreground">
            Privacy Policy <ChevronRight size={14} />
          </button>
          <button className="flex items-center justify-between w-full py-1 text-sm text-muted-foreground">
            Termini di Servizio <ChevronRight size={14} />
          </button>
          <button className="flex items-center justify-between w-full py-1 text-sm text-muted-foreground">
            Consenso biometrico <ChevronRight size={14} />
          </button>
        </motion.div>

        <p className="text-center text-[10px] text-muted-foreground py-4 font-mono-data">
          Aura v1.0.0 · I tuoi dati, il tuo controllo
        </p>
      </div>
    </div>
  );
}

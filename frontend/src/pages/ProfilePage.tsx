import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Camera, Watch, ChevronDown, Award } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;

const ALL_INTERESTS = [
  "Musica", "Viaggi", "Sport", "Arte", "Cinema", "Cucina",
  "Fotografia", "Lettura", "Yoga", "Tecnologia", "Natura", "Danza",
];

interface Badge {
  id: string;
  badge_type: string;
  title: string;
  description: string;
  icon: string;
  earned_at: string;
}

export default function ProfilePage() {
  const { token } = useAuth();
  const [name, setName] = useState("Sofia");
  const [age, setAge] = useState("27");
  const [city, setCity] = useState("Milano");
  const [bio, setBio] = useState("Amante della fotografia e dei tramonti. Cerco qualcuno con cui condividere avventure autentiche.");
  const [gender, setGender] = useState("Donna");
  const [seeking, setSeeking] = useState("Uomini");
  const [selectedInterests, setSelectedInterests] = useState<string[]>(["Viaggi", "Arte", "Fotografia"]);
  const [watchConnected, setWatchConnected] = useState(true);
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    if (token) {
      loadBadges();
    }
  }, [token]);

  const loadBadges = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/badges`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBadges(response.data);
    } catch (error) {
      console.error('Error loading badges:', error);
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : prev.length < 6 ? [...prev, interest] : prev
    );
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl mb-6">Modifica Profilo</h1>

        {/* Avatar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex justify-center mb-8"
        >
          <div className="relative">
            <div className="w-28 h-28 rounded-3xl overflow-hidden bg-muted">
              <img
                src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&q=80"
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
            <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Camera size={14} className="text-primary-foreground" />
            </button>
          </div>
        </motion.div>

        {/* Name & Age */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Nome</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Età</label>
            <input
              value={age}
              onChange={e => setAge(e.target.value)}
              type="number"
              className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* City */}
        <div className="mb-4">
          <label className="text-xs text-muted-foreground mb-1.5 block">Città</label>
          <input
            value={city}
            onChange={e => setCity(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Bio */}
        <div className="mb-4">
          <label className="text-xs text-muted-foreground mb-1.5 block">Bio</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={3}
            maxLength={200}
            className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Gender & Seeking */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Genere</label>
            <div className="relative">
              <select
                value={gender}
                onChange={e => setGender(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option>Donna</option>
                <option>Uomo</option>
                <option>Non-binario</option>
                <option>Altro</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Cerco</label>
            <div className="relative">
              <select
                value={seeking}
                onChange={e => setSeeking(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option>Uomini</option>
                <option>Donne</option>
                <option>Tutti</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Interests */}
        <div className="mb-6">
          <label className="text-xs text-muted-foreground mb-2 block">Interessi</label>
          <div className="flex flex-wrap gap-2">
            {ALL_INTERESTS.map(interest => {
              const selected = selectedInterests.includes(interest);
              return (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {interest}{selected ? " ×" : ""}
                </button>
              );
            })}
          </div>
        </div>

        {/* Smartwatch */}
        <div className="glass-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <Watch size={16} className="text-secondary" />
            <h3 className="text-sm font-semibold">Smartwatch</h3>
          </div>
          <div className="mb-3">
            <div className="relative">
              <select className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary">
                <option>Samsung Galaxy Watch</option>
                <option>Apple Watch</option>
                <option>Fitbit Sense</option>
                <option>Garmin Venu</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Connesso</span>
            <button
              onClick={() => setWatchConnected(!watchConnected)}
              className={`w-11 h-6 rounded-full transition-colors ${watchConnected ? "bg-primary" : "bg-muted"}`}
            >
              <div className={`w-5 h-5 rounded-full bg-foreground transition-transform ${watchConnected ? "translate-x-5.5" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>

        {/* Save */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          className="w-full mt-6 bg-primary text-primary-foreground py-3.5 rounded-2xl font-semibold text-sm"
        >
          Salva modifiche
        </motion.button>
      </div>
    </div>
  );
}

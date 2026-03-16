export interface UserProfile {
  id: string;
  name: string;
  age: number;
  bio: string;
  photo: string;
  interests: string[];
  city: string;
}

export interface Match {
  id: string;
  user: UserProfile;
  cardiacScore: { reciprocity: number; intensity: number; synchrony: number; total: number };
  matchedAt: string;
  lastMessage?: string;
}

export interface EmotionalReaction {
  profileId: string;
  bpmDelta: number;
  timestamp: string;
  intensity: "low" | "medium" | "high";
}

export interface AuraEvent {
  id: string;
  title: string;
  venue: string;
  venueType: "restaurant" | "pub" | "bar" | "club" | "cafe";
  description: string;
  date: string;
  time: string;
  image: string;
  city: string;
  attendees: number;
  livePulse: number; // collective excitement 0-100
  matchesInterested: UserProfile[];
  isUserInterested: boolean;
  vibe: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
}

export interface InsightData {
  date: string;
  reactions: number;
  avgIntensity: number;
}

// Mock profiles
export const mockProfiles: UserProfile[] = [
  { id: "1", name: "Elena", age: 28, bio: "Amo il jazz, i tramonti e le conversazioni profonde.", photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=80", interests: ["Jazz", "Fotografia", "Yoga"], city: "Milano" },
  { id: "2", name: "Marco", age: 31, bio: "Chef di giorno, musicista di notte. Cerco qualcuno con cui condividere entrambe le passioni.", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80", interests: ["Cucina", "Musica", "Viaggi"], city: "Roma" },
  { id: "3", name: "Sofia", age: 26, bio: "Ricercatrice in neuroscienze. Il battito del cuore è il mio linguaggio preferito.", photo: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80", interests: ["Scienza", "Lettura", "Corsa"], city: "Torino" },
  { id: "4", name: "Luca", age: 29, bio: "Architetto con la passione per il design minimale e i vinili.", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80", interests: ["Design", "Musica", "Architettura"], city: "Firenze" },
  { id: "5", name: "Giulia", age: 27, bio: "Sommelier. Ogni vino racconta una storia, ogni battito un'emozione.", photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80", interests: ["Vino", "Arte", "Teatro"], city: "Milano" },
];

// Mock matches
export const mockMatches: Match[] = [
  {
    id: "m1", user: mockProfiles[0],
    cardiacScore: { reciprocity: 45, intensity: 27, synchrony: 18, total: 90 },
    matchedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    lastMessage: "Ciao! Ho visto che ci siamo 'sentiti'... 💓",
  },
  {
    id: "m2", user: mockProfiles[2],
    cardiacScore: { reciprocity: 38, intensity: 24, synchrony: 15, total: 77 },
    matchedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
  {
    id: "m3", user: mockProfiles[4],
    cardiacScore: { reciprocity: 42, intensity: 22, synchrony: 12, total: 76 },
    matchedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    lastMessage: "Quel concerto jazz venerdì?",
  },
];

// Mock events
export const mockEvents: AuraEvent[] = [
  {
    id: "e1", title: "Jazz Night", venue: "Blue Note Milano", venueType: "club",
    description: "Una serata di jazz dal vivo con artisti internazionali. Cocktail speciali e atmosfera intima.",
    date: "2026-03-20", time: "21:00", image: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&q=80",
    city: "Milano", attendees: 34, livePulse: 78,
    matchesInterested: [mockProfiles[0], mockProfiles[4]],
    isUserInterested: false, vibe: "Intimo & Sofisticato",
  },
  {
    id: "e2", title: "Wine & Dine", venue: "Osteria del Cuore", venueType: "restaurant",
    description: "Degustazione di vini naturali accompagnati da piatti della tradizione rivisitati.",
    date: "2026-03-22", time: "20:00", image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80",
    city: "Milano", attendees: 18, livePulse: 62,
    matchesInterested: [mockProfiles[0]],
    isUserInterested: false, vibe: "Romantico & Rilassato",
  },
  {
    id: "e3", title: "Aperitivo Live", venue: "Terrazza Aperol", venueType: "bar",
    description: "DJ set al tramonto con vista panoramica sulla città. Spritz illimitati fino alle 22.",
    date: "2026-03-21", time: "18:30", image: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&q=80",
    city: "Milano", attendees: 56, livePulse: 85,
    matchesInterested: [mockProfiles[2], mockProfiles[4]],
    isUserInterested: true, vibe: "Energico & Sociale",
  },
  {
    id: "e4", title: "Pub Quiz Night", venue: "The Drunken Ship", venueType: "pub",
    description: "Sfida a squadre con domande di cultura generale, musica e cinema. Birra artigianale in premio.",
    date: "2026-03-23", time: "20:30", image: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=600&q=80",
    city: "Roma", attendees: 42, livePulse: 71,
    matchesInterested: [],
    isUserInterested: false, vibe: "Divertente & Competitivo",
  },
  {
    id: "e5", title: "Brunch & Yoga", venue: "Café Zen", venueType: "cafe",
    description: "Sessione di yoga mattutina seguita da un brunch biologico. Connessione mente-corpo garantita.",
    date: "2026-03-22", time: "10:00", image: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=600&q=80",
    city: "Torino", attendees: 22, livePulse: 55,
    matchesInterested: [mockProfiles[2]],
    isUserInterested: false, vibe: "Zen & Rilassante",
  },
];

// Mock chat messages
export const mockChatMessages: Record<string, ChatMessage[]> = {
  m1: [
    { id: "c1", senderId: "1", text: "Ciao! Ho visto che ci siamo 'sentiti'... 💓", timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: "c2", senderId: "me", text: "Sì! Il mio cuore ha parlato prima di me 😄", timestamp: new Date(Date.now() - 3500000).toISOString() },
    { id: "c3", senderId: "1", text: "Ti va un caffè questa settimana?", timestamp: new Date(Date.now() - 3000000).toISOString() },
  ],
  m3: [
    { id: "c4", senderId: "5", text: "Quel concerto jazz venerdì?", timestamp: new Date(Date.now() - 86400000).toISOString() },
  ],
};

// Mock insights
export const mockInsights: InsightData[] = Array.from({ length: 14 }, (_, i) => ({
  date: new Date(Date.now() - (13 - i) * 86400000).toISOString().split("T")[0],
  reactions: Math.floor(Math.random() * 5) + 1,
  avgIntensity: Math.floor(Math.random() * 30) + 50,
}));

export const interestReactionMap: Record<string, number> = {
  "Musica": 18, "Jazz": 16, "Arte": 14, "Fotografia": 12, "Cucina": 11,
  "Viaggi": 10, "Yoga": 9, "Vino": 8, "Design": 7, "Teatro": 6,
};

// Conversation starters
export const conversationStarters = [
  "Ho notato che entrambi amiamo {interest}... qual è stata la tua ultima scoperta?",
  "Il nostro cardiac score è {score}! Sembra che i nostri cuori parlino lo stesso linguaggio.",
  "Ciao! Con un'intensità di match così alta, dovevo per forza scriverti. Come stai?",
  "Vedo che ti interessa {interest}... ti va di scoprire un evento insieme questa settimana?",
];

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, MapPin, Users, Zap, ChevronRight, Check } from "lucide-react";
import { mockEvents, type AuraEvent } from "@/lib/mock-data";
import PulseSparkline from "@/components/PulseSparkline";

const venueIcons: Record<string, string> = {
  restaurant: "🍽️", pub: "🍺", bar: "🍸", club: "🎵", cafe: "☕",
};

export default function EventsPage() {
  const [events, setEvents] = useState(mockEvents);
  const [selectedEvent, setSelectedEvent] = useState<AuraEvent | null>(null);

  const toggleInterest = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? { ...e, isUserInterested: !e.isUserInterested, attendees: e.attendees + (e.isUserInterested ? -1 : 1) }
          : e
      )
    );
  };

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 pt-4 pb-2">
        <h1 className="font-display text-xl">Eventi</h1>
        <p className="text-xs text-muted-foreground mt-1">Trova qualcuno con cui condividere il ritmo</p>
      </div>

      <div className="px-4 space-y-3">
        {events.map((event, i) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, type: "spring", stiffness: 100, damping: 15 }}
            className="glass-panel-hover overflow-hidden"
          >
            {/* Image header */}
            <div className="relative h-36 overflow-hidden">
              <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
              <div className="absolute top-3 right-3 glass-panel px-2 py-1 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-primary rounded-full cardiac-pulse" />
                <span className="font-mono-data text-[10px] text-foreground">{event.livePulse}%</span>
                <PulseSparkline value={event.livePulse} width={40} height={16} />
              </div>
              <div className="absolute top-3 left-3 glass-panel px-2 py-1 text-xs">
                {venueIcons[event.venueType]} {event.vibe}
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-display text-lg leading-tight">{event.title}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin size={12} /> {event.venue}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays size={12} />
                      {new Date(event.date).toLocaleDateString("it-IT", { day: "numeric", month: "short" })} · {event.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {event.attendees}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-foreground/70 mt-2 line-clamp-2">{event.description}</p>

              {/* Matches interested */}
              {event.matchesInterested.length > 0 && (
                <button
                  onClick={() => setSelectedEvent(event)}
                  className="mt-3 flex items-center gap-2 glass-panel px-3 py-2 w-full group"
                >
                  <Zap size={14} className="text-secondary" />
                  <div className="flex -space-x-2">
                    {event.matchesInterested.slice(0, 3).map((u) => (
                      <img key={u.id} src={u.photo} alt={u.name} className="w-6 h-6 rounded-full border-2 border-card object-cover" />
                    ))}
                  </div>
                  <span className="text-[11px] text-secondary flex-1 text-left">
                    {event.matchesInterested.length} match interessat{event.matchesInterested.length > 1 ? "i" : "o"}
                  </span>
                  <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              )}

              {/* Action */}
              <button
                onClick={() => toggleInterest(event.id)}
                className={`mt-3 w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-240 flex items-center justify-center gap-2 ${
                  event.isUserInterested
                    ? "bg-secondary/20 text-secondary border border-secondary/30"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {event.isUserInterested ? (
                  <>
                    <Check size={16} /> Partecipo
                  </>
                ) : (
                  "Unisciti al Ritmo"
                )}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Match Detail Sheet */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              className="absolute bottom-0 left-0 right-0 glass-panel rounded-b-none p-5 max-h-[70vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
              <h3 className="font-display text-lg">Match interessati a "{selectedEvent.title}"</h3>
              <p className="text-xs text-muted-foreground mb-4">{selectedEvent.venue} · {selectedEvent.vibe}</p>

              <div className="space-y-3">
                {selectedEvent.matchesInterested.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 glass-panel p-3">
                    <img src={user.photo} alt={user.name} className="w-12 h-12 rounded-xl object-cover" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{user.name}, {user.age}</p>
                      <p className="text-xs text-muted-foreground">{user.city}</p>
                      <div className="flex gap-1 mt-1">
                        {user.interests.slice(0, 2).map((i) => (
                          <span key={i} className="text-[10px] text-secondary bg-secondary/10 px-1.5 py-0.5 rounded">
                            {i}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-lg">
                      Invita
                    </button>
                  </div>
                ))}
              </div>

              {!selectedEvent.isUserInterested && (
                <button
                  onClick={() => {
                    toggleInterest(selectedEvent.id);
                    setSelectedEvent(null);
                  }}
                  className="mt-4 w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-medium"
                >
                  Partecipa anche tu
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

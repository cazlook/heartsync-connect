import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Users, Plus, Navigation } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://bpm-social.preview.emergentagent.com';

interface Event {
  id: string;
  title: string;
  description: string;
  location: {
    latitude: number;
    longitude: number;
    city: string | null;
  };
  address: string;
  start_time: string;
  end_time: string;
  attendees_count: number;
  max_attendees: number | null;
  image_url: string | null;
  distance_km: number | null;
  is_attending: boolean;
}

export default function EventsPageRealtime() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number; lon: number} | null>(null);

  useEffect(() => {
    if (token) {
      // Request user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation({ lat: latitude, lon: longitude });
            updateUserLocation(latitude, longitude);
          },
          (error) => {
            console.log('Geolocation error:', error);
            // Use default location (Milan)
            setUserLocation({ lat: 45.4642, lon: 9.1900 });
          }
        );
      }
      
      loadEvents();
    }
  }, [token, maxDistance]);

  const updateUserLocation = async (lat: number, lon: number) => {
    try {
      await axios.put(
        `${BACKEND_URL}/api/users/location`,
        { latitude: lat, longitude: lon, city: 'Milano' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const loadEvents = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (maxDistance) {
        params.max_distance_km = maxDistance;
      }
      
      const response = await axios.get(`${BACKEND_URL}/api/events`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      
      setEvents(response.data);
    } catch (error) {
      console.error('Error loading events:', error);
      toast.error('Errore nel caricamento degli eventi');
    } finally {
      setLoading(false);
    }
  };

  const handleAttend = async (eventId: string, isAttending: boolean) => {
    try {
      if (isAttending) {
        await axios.delete(`${BACKEND_URL}/api/events/${eventId}/attend`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Non partecipi più all\'evento');
      } else {
        await axios.post(
          `${BACKEND_URL}/api/events/${eventId}/attend`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Parteciperai all\'evento!');
      }
      
      // Reload events
      loadEvents();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Errore');
    }
  };

  const createTestEvent = async () => {
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
      const endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000); // +3 hours
      
      await axios.post(
        `${BACKEND_URL}/api/events`,
        {
          title: 'Aperitivo SyncLove',
          description: 'Incontro informale per conoscersi di persona',
          latitude: userLocation ? userLocation.lat + (Math.random() - 0.5) * 0.1 : 45.4642,
          longitude: userLocation ? userLocation.lon + (Math.random() - 0.5) * 0.1 : 9.1900,
          address: 'Via Example, Milano',
          city: 'Milano',
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          max_attendees: 20,
          image_url: null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Evento creato!');
      loadEvents();
    } catch (error) {
      toast.error('Errore nella creazione dell\'evento');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="animate-pulse text-primary">Caricamento eventi...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-xl">Eventi</h1>
            <p className="text-xs text-muted-foreground">
              {userLocation ? 'Vicino a te' : 'Tutti gli eventi'}
            </p>
          </div>
          <Button onClick={createTestEvent} size="sm" variant="outline" className="gap-2">
            <Plus size={14} />
            Crea
          </Button>
        </div>

        {/* Distance Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setMaxDistance(null)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${
              maxDistance === null
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground'
            }`}
          >
            Tutti
          </button>
          {[5, 10, 25, 50].map((km) => (
            <button
              key={km}
              onClick={() => setMaxDistance(km)}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${
                maxDistance === km
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              {km} km
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="px-4 space-y-3">
        {events.length === 0 && (
          <div className="text-center py-12">
            <Calendar size={48} className="mx-auto text-muted-foreground opacity-50 mb-4" />
            <p className="text-muted-foreground text-sm">
              Nessun evento disponibile
            </p>
            <p className="text-muted-foreground text-xs mt-2">
              Crea il primo evento!
            </p>
          </div>
        )}

        {events.map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="glass-panel p-4 space-y-3"
          >
            {/* Event Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-base mb-1">{event.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {event.description}
                </p>
              </div>
              {event.distance_km !== null && (
                <div className="flex items-center gap-1 text-xs text-secondary whitespace-nowrap">
                  <Navigation size={12} />
                  {event.distance_km} km
                </div>
              )}
            </div>

            {/* Event Details */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar size={12} />
                {format(new Date(event.start_time), 'd MMM, HH:mm', { locale: it })}
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin size={12} />
                {event.address}
              </div>
              <div className="flex items-center gap-1.5">
                <Users size={12} />
                {event.attendees_count}
                {event.max_attendees && ` / ${event.max_attendees}`}
              </div>
            </div>

            {/* Attend Button */}
            <Button
              onClick={() => handleAttend(event.id, event.is_attending)}
              variant={event.is_attending ? 'outline' : 'default'}
              size="sm"
              className="w-full"
            >
              {event.is_attending ? 'Non partecipo più' : 'Partecipa'}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

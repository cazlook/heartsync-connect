import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { Heart, Camera, MapPin, Sparkles, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://bpm-social.preview.emergentagent.com';

const INTERESTS = [
  'Musica', 'Viaggi', 'Cucina', 'Sport', 'Arte', 'Cinema',
  'Lettura', 'Fotografia', 'Danza', 'Yoga', 'Escursionismo', 'Vino',
  'Gaming', 'Meditazione', 'Fitness', 'Natura',
];

const GENDERS = ['Uomo', 'Donna', 'Non-binario', 'Altro'];
const SEEKING = ['Uomini', 'Donne', 'Tutti'];

const STEPS = ['Foto', 'Profilo', 'Interessi', 'Preferenze'];

function resizeImageBase64(file: File, maxSize = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round((h * maxSize) / w); w = maxSize; }
          else { w = Math.round((w * maxSize) / h); h = maxSize; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function OnboardingPage() {
  const { user, token, setUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [photoPreview, setPhotoPreview] = useState<string | null>(user?.photos?.[0] || null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [bio, setBio] = useState(user?.bio || '');
  const [city, setCity] = useState(user?.city || '');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(user?.interests || []);
  const [gender, setGender] = useState(user?.gender || '');
  const [seeking, setSeeking] = useState(user?.seeking || 'Tutti');

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await resizeImageBase64(file);
      setPhotoPreview(b64);
      setPhotoBase64(b64);
    } catch {
      toast.error('Errore nel caricamento della foto');
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const photos = photoBase64 ? [photoBase64] : (user?.photos || []);
      const payload: Record<string, unknown> = { bio, city, interests: selectedInterests, gender, seeking, photos };
      const { data } = await axios.put(`${BACKEND_URL}/api/auth/profile`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(data);
      toast.success('Profilo completato! Benvenuto/a 💕');
      navigate('/');
    } catch {
      toast.error('Errore nel salvataggio del profilo');
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    if (step === 0) return !!photoPreview;
    if (step === 2) return selectedInterests.length >= 3;
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 flex flex-col">
      <div className="flex items-center justify-center gap-2 pt-8 pb-4">
        <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
        <span className="text-xl font-bold text-rose-600">SyncLove</span>
      </div>

      <div className="px-6 mb-6">
        <div className="flex justify-between mb-2">
          {STEPS.map((s, i) => (
            <span key={s} className={`text-xs font-medium ${i <= step ? 'text-rose-600' : 'text-gray-400'}`}>{s}</span>
          ))}
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} className="h-2" />
      </div>

      <div className="flex-1 px-6 pb-8">
        {step === 0 && (
          <div className="flex flex-col items-center gap-6 pt-4">
            <h2 className="text-2xl font-bold text-gray-900 text-center">La tua foto principale</h2>
            <p className="text-gray-500 text-center text-sm">Le persone con foto ricevono 10× più match</p>
            <div
              onClick={() => fileRef.current?.click()}
              className="w-48 h-48 rounded-full overflow-hidden border-4 border-dashed border-rose-300 flex items-center justify-center bg-rose-50 cursor-pointer hover:border-rose-500 transition-colors"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-rose-400">
                  <Camera className="w-12 h-12" />
                  <span className="text-sm font-medium">Aggiungi foto</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
            {photoPreview && (
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                Cambia foto
              </Button>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-5 pt-4">
            <h2 className="text-2xl font-bold text-gray-900">Raccontati</h2>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Bio</label>
              <Textarea
                placeholder="Scrivi qualcosa di te... (es. amo i viaggi, il caffè e i cani)"
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={300}
                rows={4}
                className="resize-none"
              />
              <span className="text-xs text-gray-400 text-right">{bio.length}/300</span>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <MapPin className="w-4 h-4" /> Città
              </label>
              <Input placeholder="es. Milano" value={city} onChange={e => setCity(e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5 pt-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-yellow-500" /> I tuoi interessi
              </h2>
              <p className="text-sm text-gray-500 mt-1">Scegli almeno 3 interessi</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(interest => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    selectedInterests.includes(interest)
                      ? 'bg-rose-500 text-white border-rose-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-rose-400'
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
            <p className="text-sm text-rose-600 font-medium">{selectedInterests.length} selezionati</p>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6 pt-4">
            <h2 className="text-2xl font-bold text-gray-900">Le tue preferenze</h2>
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-gray-700">Sono un/una</label>
              <div className="grid grid-cols-2 gap-2">
                {GENDERS.map(g => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`py-3 rounded-xl border text-sm font-medium transition-all ${
                      gender === g ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-gray-700">Cerco</label>
              <div className="grid grid-cols-3 gap-2">
                {SEEKING.map(s => (
                  <button
                    key={s}
                    onClick={() => setSeeking(s)}
                    className={`py-3 rounded-xl border text-sm font-medium transition-all ${
                      seeking === s ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 pb-8 flex gap-3">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1">
            <ChevronLeft className="w-4 h-4 mr-1" /> Indietro
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext()}
            className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"
          >
            {step === 0 && !photoPreview ? 'Aggiungi una foto per continuare' : 'Continua'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleFinish}
            disabled={loading}
            className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"
          >
            {loading ? 'Salvataggio...' : (
              <><Check className="w-4 h-4 mr-2" /> Inizia a fare match</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

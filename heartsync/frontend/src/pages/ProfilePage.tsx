import { useState, useRef } from "react";
import { Camera, MapPin, Save, LogOut, Star, Flame, Award, Edit3 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://bpm-social.preview.emergentagent.com";

const INTERESTS_LIST = ["Musica","Viaggi","Cucina","Sport","Arte","Cinema","Lettura","Fotografia","Danza","Yoga","Escursionismo","Vino","Gaming","Meditazione","Fitness","Natura"];

function resizeImageBase64(file: File, maxSize = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round((h * maxSize) / w); w = maxSize; }
          else { w = Math.round((w * maxSize) / h); h = maxSize; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const { user, token, setUser, logout } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [city, setCity] = useState(user?.city || "");
  const [age, setAge] = useState(user?.age?.toString() || "");
  const [interests, setInterests] = useState<string[]>(user?.interests || []);
  const [photo, setPhoto] = useState<string | null>(user?.photos?.[0] || null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await resizeImageBase64(file);
      setPhoto(b64);
      toast.success("Foto pronta. Salva il profilo per applicarla.");
    } catch { toast.error("Errore nel caricamento della foto"); }
  };

  const toggleInterest = (i: string) =>
    setInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const photos = photo ? [photo] : (user?.photos || []);
      const payload = { name, bio, city, age: age ? parseInt(age) : undefined, interests, photos };
      const { data } = await axios.put(`${BACKEND_URL}/api/auth/profile`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(data);
      setEditing(false);
      toast.success("Profilo salvato!");
    } catch { toast.error("Errore nel salvataggio"); }
    finally { setSaving(false); }
  };

  const initials = (user?.name || "U").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white shadow-sm px-4 pt-6 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Profilo</h1>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1">
            <Edit3 className="w-4 h-4" /> Modifica
          </Button>
        ) : (
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-rose-500 hover:bg-rose-600 text-white gap-1">
            <Save className="w-4 h-4" /> {saving ? "..." : "Salva"}
          </Button>
        )}
      </div>

      <div className="px-4 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-rose-400 to-pink-600 flex items-center justify-center">
              {photo
                ? <img src={photo} alt="profile" className="w-full h-full object-cover" />
                : <span className="text-white text-3xl font-bold">{initials}</span>
              }
            </div>
            {editing && (
              <button onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center shadow-md border-2 border-white">
                <Camera className="w-4 h-4 text-white" />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
          </div>
          <div className="flex-1">
            {editing ? (
              <Input value={name} onChange={e => setName(e.target.value)} className="font-bold text-lg mb-1" placeholder="Il tuo nome" />
            ) : (
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {user?.name}
                {user?.verified && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                {user?.premium && <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />}
              </h2>
            )}
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
          <h3 className="font-semibold text-gray-800">Info</h3>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Età</label>
              {editing
                ? <Input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="Età" className="h-9" />
                : <p className="text-gray-800 text-sm">{user?.age || "—"}</p>
              }
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1"><MapPin className="w-3 h-3" /> Città</label>
              {editing
                ? <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Città" className="h-9" />
                : <p className="text-gray-800 text-sm">{user?.city || "—"}</p>
              }
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Bio</label>
            {editing
              ? <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Raccontati..." rows={3} className="resize-none text-sm" maxLength={300} />
              : <p className="text-gray-800 text-sm">{user?.bio || "Nessuna bio"}</p>
            }
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">Interessi</h3>
          <div className="flex flex-wrap gap-2">
            {editing
              ? INTERESTS_LIST.map(i => (
                  <button key={i} onClick={() => toggleInterest(i)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${interests.includes(i) ? "bg-rose-500 text-white border-rose-500" : "bg-gray-50 text-gray-700 border-gray-200"}`}>
                    {i}
                  </button>
                ))
              : interests.length > 0
                ? interests.map(i => (
                    <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">{i}</span>
                  ))
                : <p className="text-sm text-gray-400">Nessun interesse selezionato</p>
            }
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Award className="w-4 h-4 text-rose-500" /> Badge</h3>
          {user?.verified && (
            <div className="flex items-center gap-2 bg-yellow-50 rounded-xl p-3 mb-2">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-medium text-yellow-800">Profilo verificato</span>
            </div>
          )}
          {user?.premium && (
            <div className="flex items-center gap-2 bg-orange-50 rounded-xl p-3">
              <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
              <span className="text-sm font-medium text-orange-800">Premium attivo</span>
            </div>
          )}
          {!user?.verified && !user?.premium && (
            <p className="text-sm text-gray-400">Nessun badge ancora</p>
          )}
        </div>

        <Button variant="outline" onClick={logout} className="w-full text-red-600 border-red-200 hover:bg-red-50 gap-2">
          <LogOut className="w-4 h-4" /> Logout
        </Button>
      </div>
    </div>
  );
}

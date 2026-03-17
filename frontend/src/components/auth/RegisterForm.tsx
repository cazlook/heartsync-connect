import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Heart, Mail, Lock, User } from 'lucide-react';
import { toast } from 'sonner';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export default function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    age: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await register({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        age: formData.age ? parseInt(formData.age) : undefined,
        interests: [],
        photos: [],
      });
      toast.success('Account creato con successo! 🎉');
    } catch (error: any) {
      toast.error(error.message || 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto p-6 glass-panel rounded-2xl"
    >
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Heart className="text-primary" size={32} fill="currentColor" />
        </div>
        <h1 className="font-display text-3xl mb-2">Unisciti a SyncLove</h1>
        <p className="text-muted-foreground text-sm">Crea il tuo account e inizia a connetterti</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="flex items-center gap-2">
            <User size={16} />
            Nome
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            placeholder="Il tuo nome"
            required
            className="bg-muted/50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-2">
            <Mail size={16} />
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="tua@email.com"
            required
            className="bg-muted/50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="flex items-center gap-2">
            <Lock size={16} />
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            required
            minLength={6}
            className="bg-muted/50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="age">Età (opzionale)</Label>
          <Input
            id="age"
            name="age"
            type="number"
            value={formData.age}
            onChange={handleChange}
            placeholder="25"
            min="18"
            max="100"
            className="bg-muted/50"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Creazione account...' : 'Registrati'}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Hai già un account?{' '}
          <button
            onClick={onSwitchToLogin}
            className="text-primary font-medium hover:underline"
          >
            Accedi
          </button>
        </p>
      </div>
    </motion.div>
  );
}

import { useState } from "react";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";

const BACKEND = "https://bpm-social.preview.emergentagent.com";

function App() {
  const [email, setEmail] = useState("admin@synclove.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(BACKEND + "/api/auth/login", { email, password });
      localStorage.setItem("auth_token", res.data.access_token);
      localStorage.setItem("auth_user", JSON.stringify(res.data.user));
      setLoggedIn(true);
      alert("✅ Login effettuato! User: " + res.data.user.name);
    } catch (err: any) {
      alert("❌ Errore: " + (err.response?.data?.detail || "Login fallito"));
    }
    setLoading(false);
  };

  if (loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 to-indigo-900 text-white p-4">
        <div className="text-center">
          <h1 className="text-5xl mb-4">💕 SyncLove</h1>
          <p className="text-xl mb-8">Sei loggato come Admin!</p>
          <div className="bg-white/10 p-6 rounded-lg">
            <p>✅ Backend funzionante</p>
            <p>✅ Database operativo</p>
            <p>✅ Autenticazione attiva</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 p-4">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl w-full max-w-md">
          <h1 className="text-4xl font-bold text-white text-center mb-2">💕 SyncLove</h1>
          <p className="text-purple-200 text-center mb-8">Il battito non mente</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email" 
              className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border border-white/30" 
            />
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password" 
              className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border border-white/30" 
            />
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold disabled:opacity-50"
            >
              {loading ? "Accesso..." : "Accedi"}
            </button>
          </form>
          <p className="text-center text-purple-200 text-sm mt-6">
            Credenziali Admin pre-configurate ✅
          </p>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;

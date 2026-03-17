import { BrowserRouter, Route, Routes } from "react-router-dom";

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
      <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl w-full max-w-md mx-4">
        <h1 className="text-4xl font-bold text-white text-center mb-2">💕 SyncLove</h1>
        <p className="text-purple-200 text-center mb-8">Il battito non mente</p>
        <form className="space-y-4">
          <input type="email" placeholder="Email" className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border border-white/30" />
          <input type="password" placeholder="Password" className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border border-white/30" />
          <button className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold">Accedi</button>
        </form>
        <p className="text-center text-purple-200 text-sm mt-4">Non hai un account? <span className="text-white font-semibold cursor-pointer">Registrati</span></p>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

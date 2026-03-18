import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import HomePage from "@/pages/HomePage";
import AuthPage from "@/pages/AuthPage";
import MatchesPage from "@/pages/MatchesPageRealtime";
import ChatPage from "@/pages/ChatPageRealtime";
import ProfilePage from "@/pages/ProfilePage";
import CalibrationPage from "@/pages/CalibrationPage";
import NotFound from "@/pages/NotFound";
import BottomNav from "@/components/BottomNav";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center">Caricamento...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  
  // Se l'utente non e' calibrato e non e' nella pagina di calibrazione, reindirizza
  if (!user.biometrics?.baseline_calibrated && window.location.pathname !== "/calibration") {
    return <Navigate to="/calibration" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <div className="min-h-screen bg-slate-50 pb-20">
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                
                <Route path="/" element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                } />
                
                <Route path="/calibration" element={
                  <ProtectedRoute>
                    <CalibrationPage />
                  </ProtectedRoute>
                } />
                
                <Route path="/matches" element={
                  <ProtectedRoute>
                    <MatchesPage />
                  </ProtectedRoute>
                } />
                
                <Route path="/chat/:matchId" element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                } />
                
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
              
              <ConditionalNav />
            </div>
            <Toaster />
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

const ConditionalNav = () => {
  const { user } = useAuth();
  const hideNavPaths = ["/auth", "/calibration"];
  const currentPath = window.location.pathname;
  const shouldHide = !user || hideNavPaths.includes(currentPath) || currentPath.startsWith("/chat/");
  
  if (shouldHide) return null;
  return <BottomNav />;
};

export default App;

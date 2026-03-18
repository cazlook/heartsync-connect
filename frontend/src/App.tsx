import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import React from 'react';

// Pagine essenziali
import HomePage from '@/pages/HomePage';
import AuthPage from '@/pages/AuthPage';
import MatchesPage from '@/pages/MatchesPageRealtime';
import ChatPage from '@/pages/ChatPageRealtime';
import ProfilePage from '@/pages/ProfilePage';
import CalibrationPage from '@/pages/CalibrationPage';
import SettingsPage from '@/pages/SettingsPage';
import NotFound from '@/pages/NotFound';
import BottomNav from '@/components/BottomNav';

// Pagine disabilitate (stub)
import EventsPage from '@/pages/EventsPage';
import InsightsPage from '@/pages/InsightsPage';
import NotificationCenterPage from '@/pages/NotificationCenterPage';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center text-white">Caricamento...</div>;
  if (!user) return <Navigate to="/auth" replace />;

  // Redirect a calibrazione se non ancora calibrato
  if (!(user as any).biometrics?.baseline_calibrated && window.location.pathname !== '/calibration') {
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
            <div className="min-h-screen bg-slate-900">
              <Routes>
                {/* Auth */}
                <Route path="/auth" element={<AuthPage />} />

                {/* Calibrazione biometrica - protetta ma senza redirect calibration check */}
                <Route path="/calibration" element={
                  <ProtectedRoute>
                    <CalibrationPage />
                  </ProtectedRoute>
                } />

                {/* Pagina principale - browsing biometrico */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <HomePage />
                    <BottomNav />
                  </ProtectedRoute>
                } />

                {/* Match biometrici */}
                <Route path="/matches" element={
                  <ProtectedRoute>
                    <MatchesPage />
                    <BottomNav />
                  </ProtectedRoute>
                } />

                {/* Chat base */}
                <Route path="/chat/:id" element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                } />

                {/* Profili */}
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <ProfilePage />
                    <BottomNav />
                  </ProtectedRoute>
                } />
                <Route path="/profile/:id" element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } />

                {/* Impostazioni */}
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <SettingsPage />
                    <BottomNav />
                  </ProtectedRoute>
                } />

                {/* Pagine disabilitate - stub */}
                <Route path="/events" element={<EventsPage />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route path="/notifications" element={<NotificationCenterPage />} />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

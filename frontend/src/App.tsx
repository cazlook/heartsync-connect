import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import React from 'react';

/**
 * CODE SPLITTING con React.lazy:
 * Ogni pagina viene caricata come chunk separato solo quando necessario.
 * Motivi di sicurezza:
 * - Impedisce che l'intero codice app (incluse route admin/interne) sia
 *   scaricabile in un unico bundle da chiunque.
 * - Riduce la superficie di attacco: un attaccante non puo' mappare
 *   tutti gli endpoint API leggendo il bundle principale.
 * - Migliora le performance: carica solo il codice che serve.
 */

// Pagine core (caricate subito)
const AuthPage = lazy(() => import('@/pages/AuthPage'));
const HomePage = lazy(() => import('@/pages/HomePage'));
const CalibrationPage = lazy(() => import('@/pages/CalibrationPage'));

// Pagine secondarie (lazy loaded - chunk separati)
const MatchesPage = lazy(() => import('@/pages/MatchesPageRealtime'));
const ChatPage = lazy(() => import('@/pages/ChatPageRealtime'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Pagine disabilitate (lazy - mai nel bundle principale)
const EventsPage = lazy(() => import('@/pages/EventsPage'));
const InsightsPage = lazy(() => import('@/pages/InsightsPage'));
const NotificationCenterPage = lazy(() => import('@/pages/NotificationCenterPage'));

// BottomNav e' usata ovunque, import statico OK
import BottomNav from '@/components/BottomNav';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

// Fallback UI durante il caricamento lazy
const PageLoader = () => (
  <div className="h-screen flex items-center justify-center bg-slate-900">
    <div className="text-white text-center">
      <div className="text-3xl mb-3 animate-pulse">❤️</div>
      <p className="text-slate-400 text-sm">Caricamento...</p>
    </div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;

  // Redirect a calibrazione se l'utente non e' ancora calibrato
  // NOTA: questo e' solo un redirect UX. Il vero controllo di accesso
  // ai dati biometrici e' SEMPRE nel backend.
  const biometrics = (user as any)?.biometrics;
  if (!biometrics?.baseline_calibrated && window.location.pathname !== '/calibration') {
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
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Autenticazione */}
                  <Route path="/auth" element={<AuthPage />} />

                  {/* Calibrazione biometrica */}
                  <Route path="/calibration" element={
                    <ProtectedRoute>
                      <CalibrationPage />
                    </ProtectedRoute>
                  } />

                  {/* Home - browsing biometrico */}
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

                  {/* Chat - chunk separato */}
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

                  {/* Feature disabilitate - stub in chunk separati */}
                  <Route path="/events" element={<EventsPage />} />
                  <Route path="/insights" element={<InsightsPage />} />
                  <Route path="/notifications" element={<NotificationCenterPage />} />

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </div>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

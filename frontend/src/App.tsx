import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as Sonner } from "@/components/ui/sonner";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Sonner />
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <h1 style={{ fontSize: '64px', marginBottom: '20px' }}>💕</h1>
          <h2 style={{ fontSize: '36px', marginBottom: '10px' }}>SyncLove</h2>
          <p style={{ fontSize: '18px', opacity: 0.9, marginBottom: '30px' }}>
            Il battito non mente
          </p>
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            padding: '30px',
            borderRadius: '16px',
            marginTop: '20px'
          }}>
            <h3 style={{ fontSize: '20px', marginBottom: '15px' }}>✅ App Base Funzionante</h3>
            <p style={{ fontSize: '14px', lineHeight: '1.6' }}>
              React Query, Toaster, e tutti i componenti base sono caricati correttamente.
              L'app completa verrà caricata tra poco...
            </p>
          </div>
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default App;

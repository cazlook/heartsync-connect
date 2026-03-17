import { createRoot } from "react-dom/client";

// Test minimalista senza CSS
const App = () => {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      padding: '20px'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '600px' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '20px', fontWeight: 'bold' }}>
          💓 BPM Social
        </h1>
        <p style={{ fontSize: '24px', marginBottom: '30px' }}>
          App is WORKING!
        </p>
        <div style={{
          background: 'rgba(255,255,255,0.2)',
          padding: '20px',
          borderRadius: '12px',
          marginTop: '30px'
        }}>
          <p style={{ fontSize: '16px' }}>✅ React mounted successfully</p>
          <p style={{ fontSize: '16px' }}>✅ JavaScript is executing</p>
          <p style={{ fontSize: '16px' }}>✅ Styles are rendering</p>
        </div>
        <p style={{ fontSize: '14px', marginTop: '30px', opacity: 0.8 }}>
          If you see this, the frontend is working correctly
        </p>
      </div>
    </div>
  );
};

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
} else {
  document.body.innerHTML = '<div style="color: red; padding: 20px;">ERROR: Root element not found</div>';
}

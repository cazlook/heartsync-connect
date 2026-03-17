function App() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a1a2e',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>💓 SyncLove</h1>
        <p style={{ fontSize: '20px', marginBottom: '30px' }}>Loading App...</p>
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          padding: '20px',
          borderRadius: '12px',
          marginTop: '20px'
        }}>
          <p>✅ React is rendering</p>
          <p>✅ App component loaded</p>
          <p>⏳ Full app will load next...</p>
        </div>
      </div>
    </div>
  );
}

export default App;

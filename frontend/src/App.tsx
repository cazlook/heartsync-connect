import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AuthPage from "@/pages/AuthPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<AuthPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import BottomNav from "@/components/BottomNav";
import DiscoveryPage from "@/pages/DiscoveryPage";
import EventsPage from "@/pages/EventsPage";
import MatchesPage from "@/pages/MatchesPage";
import ChatPage from "@/pages/ChatPage";
import InsightsPage from "@/pages/InsightsPage";
import SettingsPage from "@/pages/SettingsPage";
import HomePage from "@/pages/HomePage";
import ProfilePage from "@/pages/ProfilePage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <div className="max-w-lg mx-auto min-h-screen relative">
          <Routes>
            <Route path="/" element={<DiscoveryPage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/chat/:matchId" element={<ChatPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomNav />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

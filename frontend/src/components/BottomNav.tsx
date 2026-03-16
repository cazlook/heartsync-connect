import { Heart, Users, CalendarDays, BarChart3, Home, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const tabs = [
  { path: "/home", icon: Home, label: "Home" },
  { path: "/", icon: Heart, label: "Scopri" },
  { path: "/events", icon: CalendarDays, label: "Eventi" },
  { path: "/matches", icon: Users, label: "Match" },
  { path: "/profile", icon: User, label: "Profilo" },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-panel rounded-none border-t border-border/50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = pathname === path || (path !== "/" && pathname.startsWith(path));
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex flex-col items-center gap-0.5 py-1 px-3 relative"
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              )}
              <Icon
                size={20}
                className={active ? "text-primary" : "text-muted-foreground"}
              />
              <span className={`text-[10px] ${active ? "text-primary font-medium" : "text-muted-foreground"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

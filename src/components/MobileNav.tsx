import { Link } from "@tanstack/react-router";
import { Home, Search, MessageSquare, User, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";

export function MobileNav() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border pb-safe">
      <ul className="flex items-center justify-between px-4 py-2">
        <li className="flex-1">
          <Link to="/" activeProps={{ className: "text-foreground" }} className="flex flex-col items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground">
            <Home className="h-6 w-6" strokeWidth={1.5} />
            <span>Home</span>
          </Link>
        </li>
        <li className="flex-1">
          <Link to="/browse" activeProps={{ className: "text-foreground" }} className="flex flex-col items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground">
            <Search className="h-6 w-6" strokeWidth={1.5} />
            <span>Search</span>
          </Link>
        </li>
        
        {/* Prominent Sell Button */}
        <li className="flex-1 flex justify-center -mt-6">
          <Link to="/sell" className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform">
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </Link>
        </li>

        <li className="flex-1">
          <Link to="/inbox" activeProps={{ className: "text-foreground" }} className="flex flex-col items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground">
            <MessageSquare className="h-6 w-6" strokeWidth={1.5} />
            <span>Inbox</span>
          </Link>
        </li>
        <li className="flex-1">
          {mounted && user ? (
            <Link to="/profile" activeProps={{ className: "text-foreground" }} className="flex flex-col items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground">
              <User className="h-6 w-6" strokeWidth={1.5} />
              <span>Profile</span>
            </Link>
          ) : (
            <Link to="/auth" activeProps={{ className: "text-foreground" }} className="flex flex-col items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground">
              <User className="h-6 w-6" strokeWidth={1.5} />
              <span>Profile</span>
            </Link>
          )}
        </li>
      </ul>
    </nav>
  );
}

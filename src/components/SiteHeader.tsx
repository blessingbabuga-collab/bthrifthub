import { Link, useNavigate } from "@tanstack/react-router";
import { Search, ShoppingBag, User, LogOut } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/" }); };
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-background/80 border-b border-border">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-3">
        <Logo className="h-8" />
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-md mx-6 px-3 h-10 rounded-full bg-secondary border border-border">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search thrift, brands, sellers…"
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground"
          />
        </div>
        <nav className="flex items-center gap-1">
          <Link to="/browse" className="hidden sm:inline px-3 py-2 text-sm hover:text-amber transition-colors">Browse</Link>
          <Link to="/sell" className="hidden sm:inline px-3 py-2 text-sm hover:text-amber transition-colors">Sell</Link>
          {user && <Link to="/orders" className="hidden sm:inline px-3 py-2 text-sm hover:text-amber transition-colors">Orders</Link>}
          <Link to="/cart" aria-label="Cart" className="p-2 rounded-full hover:bg-secondary transition-colors">
            <ShoppingBag className="h-5 w-5" />
          </Link>
          {user ? (
            <button onClick={signOut} aria-label="Sign out" className="p-2 rounded-full hover:bg-secondary transition-colors">
              <LogOut className="h-5 w-5" />
            </button>
          ) : (
            <Link to="/auth" aria-label="Account" className="p-2 rounded-full hover:bg-secondary transition-colors">
              <User className="h-5 w-5" />
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

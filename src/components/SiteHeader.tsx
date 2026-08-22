import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, ShoppingBag, User, LogOut } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/" }); };
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a0c]/70 border-b border-white/5 shadow-2xl">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-3">
        <Logo className="h-8" />
        <form onSubmit={(e) => { e.preventDefault(); const q = new FormData(e.currentTarget).get("q"); if (q) navigate({ to: "/browse", search: { q: q.toString() } }); }} className="hidden md:flex items-center gap-2 flex-1 max-w-md mx-6 px-4 h-11 rounded-full bg-white/5 border border-white/10 hover:border-white/20 focus-within:border-amber-500/50 focus-within:bg-white/10 focus-within:ring-4 focus-within:ring-amber-500/10 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)]">
          <Search className="h-4 w-4 text-white/50" />
          <input
            name="q"
            placeholder="Search thrift, brands, sellers…"
            className="bg-transparent outline-none text-sm flex-1 text-white placeholder:text-white/40"
          />
        </form>
        <nav className="flex items-center gap-2">
          <Link to="/browse" className="hidden sm:inline px-4 py-2 text-sm text-white/80 font-medium hover:text-white hover:bg-white/5 rounded-full transition-all">Browse</Link>
          <Link to="/store-setup" className="hidden sm:inline px-4 py-2 text-sm text-white/80 font-medium hover:text-white hover:bg-white/5 rounded-full transition-all">Set Up Store</Link>
          <Link to="/sell" className="hidden sm:inline px-5 py-2 text-sm font-bold bg-gradient-to-b from-amber-400 to-amber-600 text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_4px_14px_0_rgba(245,158,11,0.2)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_6px_20px_0_rgba(245,158,11,0.4)] hover:-translate-y-0.5 active:scale-95 rounded-full transition-all">Sell</Link>
          {isMounted && user && <Link to="/orders" className="hidden sm:inline px-4 py-2 text-sm text-white/80 font-medium hover:text-white hover:bg-white/5 rounded-full transition-all">Orders</Link>}
          <Link to="/cart" aria-label="Cart" className="p-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all">
            <ShoppingBag className="h-5 w-5" />
          </Link>
          {isMounted ? (
            user ? (
              <button onClick={signOut} aria-label="Sign out" className="p-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all">
                <LogOut className="h-5 w-5" />
              </button>
            ) : (
              <Link to="/auth" aria-label="Account" className="p-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all">
                <User className="h-5 w-5" />
              </Link>
            )
          ) : (
            <div className="w-10 h-10 p-2.5"></div>
          )}
        </nav>
      </div>
    </header>
  );
}

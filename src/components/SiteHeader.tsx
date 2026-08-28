import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, ShoppingBag, User, Heart } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export function SiteHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { data: hasStore } = useQuery({
    queryKey: ['hasStore', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from('bank_accounts').select('id').eq('user_id', user!.id).maybeSingle();
      return !!data;
    }
  });

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-6">
        <div className="flex-shrink-0 flex items-center">
          <Logo className="h-8" />
        </div>
        
        <form 
          onSubmit={(e) => { 
            e.preventDefault(); 
            const q = new FormData(e.currentTarget).get("q"); 
            if (q) navigate({ to: "/browse", search: { q: q.toString() } }); 
          }} 
          className="hidden md:flex items-center gap-2 flex-1 max-w-lg px-4 h-11 rounded-full bg-secondary text-secondary-foreground border border-transparent focus-within:border-border focus-within:bg-background transition-all"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            name="q"
            placeholder="Search thrift, brands, sellers…"
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground"
          />
        </form>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link to="/browse" className="hidden sm:flex px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Browse</Link>
          
          {isMounted && user && !hasStore && (
            <Link to="/store-setup" className="hidden sm:flex px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Open Store</Link>
          )}

          <Link to="/sell" className="hidden sm:flex px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 rounded-full transition-all shadow-glow">Sell Item</Link>
          
          {isMounted && user && (
            <Link to="/orders" className="hidden sm:flex px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Orders</Link>
          )}

          <div className="flex items-center ml-2 sm:border-l border-border sm:pl-4 space-x-1">
            <Link to="/wishlist" aria-label="Saved" className="p-2.5 rounded-full text-foreground hover:bg-secondary active:scale-95 transition-all">
              <Heart className="h-5 w-5" />
            </Link>
            <Link to="/cart" aria-label="Cart" className="p-2.5 rounded-full text-foreground hover:bg-secondary active:scale-95 transition-all">
              <ShoppingBag className="h-5 w-5" />
            </Link>
            
            {isMounted ? (
              user ? (
                <Link to="/profile" aria-label="Profile" className="hidden sm:flex p-2.5 rounded-full text-foreground hover:bg-secondary active:scale-95 transition-all">
                  <User className="h-5 w-5" />
                </Link>
              ) : (
                <Link to="/auth" aria-label="Account" className="hidden sm:flex p-2.5 rounded-full text-foreground hover:bg-secondary active:scale-95 transition-all">
                  <User className="h-5 w-5" />
                </Link>
              )
            ) : (
              <div className="hidden sm:block w-10 h-10 p-2.5"></div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

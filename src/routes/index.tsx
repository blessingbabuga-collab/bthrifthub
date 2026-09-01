import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck, ShoppingBag, Store, Truck, Wallet, ArrowRight, Play,
  Sparkles, Star, Flame, Shirt, Footprints, Briefcase, Sofa, Smartphone, Quote,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { ProductCard } from "@/components/ProductCard";
import { fetchProducts } from "@/lib/products";
import model from "@/assets/model-1.jpg";
import jacket from "@/assets/product-jacket.jpg";
import bag from "@/assets/product-bag.jpg";
import shoes from "@/assets/product-shoes.jpg";
import shades from "@/assets/product-shades.jpg";
import flatlay from "@/assets/thrift-flatlay.jpg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "BTHRIFTS — The Premium Thrift Marketplace" },
      { name: "description", content: "Buy & sell affordable thrift fashion, shoes, bags, furniture and gadgets. A global thrift community." },
    ],
  }),
});




function Index() {
  const { data: dbProducts } = useQuery({ queryKey: ["products", "trending"], queryFn: () => fetchProducts({ limit: 8 }) });
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await (supabase as any).from('categories').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });
  
  // Only use DB products, no dummy fallback
  const products = dbProducts || [];

  return (
    <div className="min-h-screen pb-24 sm:pb-0 bg-background">
      <SiteHeader />

      {/* PREMIUM STORIES / CATEGORIES */}
      <section className="pt-5 pb-3">
        <div className="flex gap-4 overflow-x-auto no-scrollbar px-5 pb-2 max-w-6xl mx-auto w-full sm:justify-center">
          {categories.map(({ image_url, name }: any) => (
            <Link key={name} to="/browse" search={{ q: name }} className="flex flex-col items-center gap-2 shrink-0 group cursor-pointer">
              <div className="w-[72px] h-[72px] rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-amber-500 to-orange-500">
                <div className="w-full h-full rounded-full border-2 border-background overflow-hidden bg-muted flex items-center justify-center text-muted-foreground">
                  {image_url ? (
                    <img src={image_url} alt={name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <span className="text-xs">{name.charAt(0)}</span>
                  )}
                </div>
              </div>
              <span className="text-[11px] font-medium text-foreground/90 tracking-tight">{name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* FEED HEADER */}
      <section className="mx-auto max-w-6xl px-5 mt-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-xl tracking-tight text-foreground">
            Just Dropped
          </h2>
        </div>
        
        {/* MASONRY/GRID FEED */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {products.map((p: any) => <ProductCard key={p.id} p={p as any} />)}
        </div>
      </section>

      {/* HIDDEN ON MOBILE: Desktop-only Marketing Info */}
      <section className="hidden sm:block mx-auto max-w-6xl px-4 mt-20">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { Icon: ShieldCheck, t: "Escrow Protected", d: "We hold payment until you confirm delivery." },
            { Icon: Wallet, t: "List in Seconds", d: "Snap, price, publish instantly." },
            { Icon: Truck, t: "Reliable Delivery", d: "Trusted couriers with tracking." },
          ].map(({ Icon, t, d }) => (
            <div key={t} className="bg-card border border-border rounded-2xl p-5">
              <div className="h-10 w-10 rounded-xl bg-amber/10 flex items-center justify-center mb-3">
                <Icon className="h-5 w-5 text-amber" />
              </div>
              <h3 className="font-semibold">{t}</h3>
              <p className="text-xs text-muted-foreground mt-1">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="hidden sm:block">
        <SiteFooter />
      </div>
      <MobileNav />
    </div>
  );
}

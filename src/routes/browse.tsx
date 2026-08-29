import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { BackButton } from "@/components/BackButton";
import { ProductCard } from "@/components/ProductCard";

import { fetchProducts } from "@/lib/products";
import { SlidersHorizontal } from "lucide-react";

export const Route = createFileRoute("/browse")({
  component: Browse,
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({ q: search.q as string | undefined }),
  head: () => ({ meta: [{ title: "Browse Thrift — Bthrifs Marketplace" }] }),
});

function Browse() {
  const { q } = Route.useSearch();
  const [cat, setCat] = useState<string>("All");
  
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await (supabase as any).from('categories').select('*').order('name');
      if (error) throw error;
      return data as { id: string, name: string, image_url: string }[];
    }
  });

  const { data, isLoading } = useQuery({
    queryKey: ["products", cat, q],
    queryFn: () => fetchProducts({ category: cat === "All" ? undefined : cat, search: q }),
  });
  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <BackButton fallback="/" />
        <h1 className="font-display text-4xl md:text-5xl">Browse Thrift</h1>
        <p className="text-sm text-muted-foreground mt-1">Curated finds from trusted thrift sellers.</p>

        <div className="mt-6 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          <button className="shrink-0 inline-flex items-center gap-2 px-4 h-10 rounded-full border border-amber text-amber text-sm">
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </button>
          {["All", ...categories.map((c) => c.name)].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 px-4 h-10 rounded-full text-sm border transition-colors ${cat === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-amber"}`}
            >
              {c}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[4/5] rounded-2xl bg-secondary animate-pulse" />)}
          </div>
        )}
        {!isLoading && data && data.length === 0 && (
          <div className="mt-12 text-center bg-card border border-border rounded-3xl p-10">
            <p className="text-muted-foreground">No listings yet in this category.</p>
          </div>
        )}
        {data && data.length > 0 && (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {data.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </div>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}

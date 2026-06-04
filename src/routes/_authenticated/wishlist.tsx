import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/products";
import { Heart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/wishlist")({ component: WishlistPage });

type Row = { id: string; product: { id: string; title: string; price: number; image_url: string } };

function WishlistPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["wishlist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("id, product:products(id, title, price, image_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const remove = async (id: string) => {
    const { error } = await supabase.from("wishlist_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["wishlist"] });
  };

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-10">
        <BackButton fallback="/browse" />
        <h1 className="font-display text-4xl">Your wishlist</h1>
        {isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
        {!isLoading && (!data || data.length === 0) && (
          <div className="mt-10 text-center bg-card border border-border rounded-3xl p-10">
            <Heart className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">No saved items yet.</p>
            <Link to="/browse" className="mt-4 inline-flex h-11 px-6 items-center rounded-full bg-primary text-primary-foreground font-semibold">Discover thrift</Link>
          </div>
        )}
        {data && data.length > 0 && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.map((r) => (
              <div key={r.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <Link to="/product/$id" params={{ id: r.product.id }}>
                  <img src={r.product.image_url} alt={r.product.title} className="w-full aspect-square object-cover" />
                </Link>
                <div className="p-3">
                  <p className="text-sm font-medium line-clamp-1">{r.product.title}</p>
                  <p className="text-amber font-bold mt-1">{formatNaira(Number(r.product.price))}</p>
                  <button onClick={() => remove(r.id)} className="mt-2 text-xs text-muted-foreground hover:text-destructive">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/products";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cart")({ component: CartPage });

type Row = { id: string; quantity: number; product: { id: string; title: string; price: number; image_url: string; location: string | null } };

function CartPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("id, quantity, product:products(id, title, price, image_url, location)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const remove = async (id: string) => {
    const { error } = await supabase.from("cart_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["cart"] });
  };

  const total = (data ?? []).reduce((s, r) => s + Number(r.product.price) * r.quantity, 0);

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-4xl">Your cart</h1>
        {isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
        {!isLoading && (!data || data.length === 0) && (
          <div className="mt-10 text-center bg-card border border-border rounded-3xl p-10">
            <p className="text-muted-foreground">Your cart is empty.</p>
            <Link to="/browse" className="mt-4 inline-flex h-11 px-6 items-center rounded-full bg-primary text-primary-foreground font-semibold">Browse thrift</Link>
          </div>
        )}
        {data && data.length > 0 && (
          <>
            <ul className="mt-6 space-y-3">
              {data.map((r) => (
                <li key={r.id} className="bg-card border border-border rounded-2xl p-3 flex gap-3 items-center">
                  <Link to="/product/$id" params={{ id: r.product.id }} className="shrink-0">
                    <img src={r.product.image_url} alt={r.product.title} className="w-20 h-20 rounded-xl object-cover" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to="/product/$id" params={{ id: r.product.id }} className="font-medium line-clamp-1">{r.product.title}</Link>
                    <p className="text-xs text-muted-foreground">{r.product.location ?? ""}</p>
                    <p className="mt-1 text-amber font-bold">{formatNaira(Number(r.product.price))} × {r.quantity}</p>
                  </div>
                  <button onClick={() => remove(r.id)} className="p-2 rounded-full hover:bg-secondary"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <div className="mt-8 bg-card border border-border rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Subtotal</p>
                <p className="font-display text-3xl text-amber">{formatNaira(total)}</p>
              </div>
              <button className="h-12 px-6 rounded-full bg-primary text-primary-foreground font-semibold shadow-glow">Checkout</button>
            </div>
          </>
        )}
      </div>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}
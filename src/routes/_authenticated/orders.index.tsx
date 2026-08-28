import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/products";
import { Package, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders/")({
  component: OrdersPage,
  head: () => ({ meta: [{ title: "My Orders — Bthrifts" }] }),
});

type Order = {
  id: string; buyer_id: string; status: string; total: number; created_at: string; tracking_code: string;
  order_items: { title: string; image_url: string; quantity: number; seller_id: string }[];
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber/20 text-amber",
  paid: "bg-blue-500/20 text-blue-400",
  shipped: "bg-indigo-500/20 text-indigo-300",
  out_for_delivery: "bg-purple-500/20 text-purple-300",
  delivered: "bg-emerald-500/20 text-emerald-400",
  cancelled: "bg-destructive/20 text-destructive",
};

function OrdersPage() {
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<"purchases" | "sales">("purchases");
  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, buyer_id, status, total, created_at, tracking_code, order_items(title, image_url, quantity, seller_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Order[];
    },
  });

  const purchases = data?.filter((o) => o.buyer_id === user?.id) ?? [];
  const sales = data?.filter((o) => o.order_items.some((i) => i.seller_id === user?.id)) ?? [];
  const currentData = tab === "purchases" ? purchases : sales;

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-12 animate-fade-in">
        <BackButton fallback="/" />
        <h1 className="font-display text-4xl mt-4 tracking-tight text-foreground/95">My orders</h1>
        <p className="text-base text-muted-foreground mt-2 font-medium">Track deliveries and view past purchases.</p>

        <div className="mt-8 flex gap-2 border-b border-border/50 pb-4">
          <button onClick={() => setTab("purchases")} className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${tab === "purchases" ? "bg-secondary text-foreground shadow-md border border-border" : "bg-transparent text-muted-foreground/80 hover:text-foreground/80 hover:bg-muted"}`}>Purchases</button>
          <button onClick={() => setTab("sales")} className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${tab === "sales" ? "bg-secondary text-foreground shadow-md border border-border" : "bg-transparent text-muted-foreground/80 hover:text-foreground/80 hover:bg-muted"}`}>Sales</button>
        </div>

        {isLoading && <p className="mt-8 text-muted-foreground/80 font-medium">Loading…</p>}
        {!isLoading && currentData.length === 0 && (
          <div className="mt-8 bg-card border border-border/50 rounded-[24px] p-12 text-center shadow-sm">
            <Package className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="mt-4 text-foreground font-medium text-lg">No {tab} yet.</p>
            {tab === "purchases" && <Link to="/browse" className="mt-6 inline-flex h-12 px-8 items-center rounded-full bg-secondary text-foreground font-bold hover:bg-secondary/80 transition-all border border-border/50 shadow-sm">Browse thrift</Link>}
            {tab === "sales" && <Link to="/sell" className="mt-6 inline-flex h-12 px-8 items-center rounded-full bg-primary text-primary-foreground font-bold hover:opacity-90 active:scale-95 transition-all shadow-glow">Sell an item</Link>}
          </div>
        )}
        {currentData.length > 0 && (
          <ul className="mt-8 space-y-4">
            {currentData.map((o) => (
              <li key={o.id}>
                <Link to="/orders/$id" params={{ id: o.id }} className="group block bg-card shadow-sm border border-border hover:border-primary/30 hover:shadow-md transition-all duration-300 rounded-[20px] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                        <span className="text-xs font-mono text-muted-foreground">#{o.tracking_code}</span>
                        <span className={`text-[10px] uppercase tracking-[0.1em] font-bold px-2.5 py-1 rounded-full ${STATUS_BADGE[o.status] ?? "bg-secondary text-foreground"}`}>{o.status.replace(/_/g, " ")}</span>
                      </div>
                      <p className="mt-2 text-sm text-foreground font-medium line-clamp-1 group-hover:text-primary transition-colors">
                        {o.order_items.map((i) => `${i.title} × ${i.quantity}`).join(", ")}
                      </p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground font-medium">{new Date(o.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex -space-x-3">
                        {o.order_items.slice(0, 3).map((i, idx) => (
                          <img key={idx} src={i.image_url} alt="" className="w-12 h-12 rounded-xl object-cover border-2 border-background shadow-sm" />
                        ))}
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-display tracking-tight text-xl text-foreground">{formatNaira(Number(o.total))}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}
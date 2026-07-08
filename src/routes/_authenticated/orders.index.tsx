import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
  id: string; status: string; total: number; created_at: string; tracking_code: string;
  order_items: { title: string; image_url: string; quantity: number }[];
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
  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total, created_at, tracking_code, order_items(title, image_url, quantity)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Order[];
    },
  });

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <BackButton fallback="/" />
        <h1 className="font-display text-4xl">My orders</h1>
        <p className="text-sm text-muted-foreground mt-1">Track deliveries and view past purchases.</p>

        {isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
        {!isLoading && (!data || data.length === 0) && (
          <div className="mt-10 bg-card border border-border rounded-3xl p-10 text-center">
            <Package className="h-8 w-8 text-amber mx-auto" />
            <p className="mt-3 text-muted-foreground">No orders yet.</p>
            <Link to="/browse" className="mt-4 inline-flex h-11 px-6 items-center rounded-full bg-primary text-primary-foreground font-semibold">Browse thrift</Link>
          </div>
        )}
        {data && data.length > 0 && (
          <ul className="mt-6 space-y-3">
            {data.map((o) => (
              <li key={o.id}>
                <Link to="/orders/$id" params={{ id: o.id }} className="block bg-card border border-border hover:border-amber transition-colors rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">#{o.tracking_code}</span>
                        <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[o.status] ?? ""}`}>{o.status.replace(/_/g, " ")}</span>
                      </div>
                      <p className="mt-1 text-sm line-clamp-1">
                        {o.order_items.map((i) => `${i.title} × ${i.quantity}`).join(", ")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex -space-x-2">
                        {o.order_items.slice(0, 3).map((i, idx) => (
                          <img key={idx} src={i.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border-2 border-card" />
                        ))}
                      </div>
                      <div className="text-right">
                        <p className="font-display text-lg text-amber">{formatNaira(Number(o.total))}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/products";
import { toast } from "sonner";
import { CheckCircle2, Circle, Package, Truck, MapPin, Home, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  component: OrderDetail,
  head: () => ({ meta: [{ title: "Order tracking — Bthrifts" }] }),
});

type Order = {
  id: string; status: string; subtotal: number; shipping_fee: number; total: number;
  payment_method: string; payment_ref: string | null; tracking_code: string;
  full_name: string; phone: string; address_line: string; city: string; state: string; notes: string | null;
  created_at: string;
  order_items: { id: string; title: string; image_url: string; unit_price: number; quantity: number }[];
  order_status_events: { id: string; status: string; note: string | null; created_at: string }[];
};

const STAGES = [
  { key: "pending", label: "Order placed", Icon: Package },
  { key: "paid", label: "Payment received", Icon: CheckCircle2 },
  { key: "shipped", label: "Shipped", Icon: Truck },
  { key: "out_for_delivery", label: "Out for delivery", Icon: MapPin },
  { key: "delivered", label: "Delivered", Icon: Home },
] as const;

function OrderDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(id, title, image_url, unit_price, quantity), order_status_events(id, status, note, created_at)")
        .eq("id", id)
        .single();
      if (error) throw error;
      (data as unknown as Order).order_status_events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return data as unknown as Order;
    },
  });

  const advance = async (next: string, note: string) => {
    await supabase.from("orders").update({ status: next }).eq("id", id);
    await supabase.from("order_status_events").insert({ order_id: id, status: next, note });
    toast.success(`Order marked ${next.replace(/_/g, " ")}`);
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  const cancel = async () => {
    if (!confirm("Cancel this order?")) return;
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
    await supabase.from("order_status_events").insert({ order_id: id, status: "cancelled", note: "Cancelled by buyer" });
    toast.success("Order cancelled");
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  if (isLoading || !data) {
    return (
      <div className="min-h-screen pb-20 sm:pb-0">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-4 py-10">
          <BackButton fallback="/orders" />
          <p className="mt-4 text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  const o = data;
  const currentIdx = STAGES.findIndex((s) => s.key === o.status);
  const cancelled = o.status === "cancelled";

  const nextStage = (() => {
    if (cancelled || o.status === "delivered") return null;
    const idx = STAGES.findIndex((s) => s.key === o.status);
    return STAGES[idx + 1] ?? null;
  })();

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <BackButton fallback="/orders" />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-display text-4xl">Order #{o.tracking_code}</h1>
            <p className="text-sm text-muted-foreground mt-1">Placed {new Date(o.created_at).toLocaleString()}</p>
          </div>
          <Link to="/orders" className="text-sm text-amber hover:underline">All orders →</Link>
        </div>

        {/* Tracking timeline */}
        <section className="mt-8 bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display text-2xl mb-5">Delivery tracking</h2>
          {cancelled ? (
            <div className="flex items-center gap-3 text-destructive">
              <XCircle className="h-6 w-6" />
              <div>
                <p className="font-semibold">Order cancelled</p>
                <p className="text-xs text-muted-foreground">This order was cancelled and won't be delivered.</p>
              </div>
            </div>
          ) : (
            <ol className="space-y-4">
              {STAGES.map((s, idx) => {
                const done = idx <= currentIdx;
                const active = idx === currentIdx;
                const Icon = s.Icon;
                const event = o.order_status_events.find((e) => e.status === s.key);
                return (
                  <li key={s.key} className="flex gap-3">
                    <div className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center border-2 ${done ? "border-emerald-500 bg-emerald-500/10 text-emerald-500" : "border-border text-muted-foreground"}`}>
                      {done ? <Icon className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 pb-1">
                      <p className={`font-semibold ${active ? "text-amber" : done ? "" : "text-muted-foreground"}`}>{s.label}</p>
                      {event && <p className="text-xs text-muted-foreground mt-0.5">{event.note} · {new Date(event.created_at).toLocaleString()}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {nextStage && (
            <button
              onClick={() => advance(nextStage.key, `Marked ${nextStage.label.toLowerCase()}`)}
              className="mt-6 w-full h-11 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition-colors"
            >
              Mark as {nextStage.label}
            </button>
          )}
          {!cancelled && o.status !== "delivered" && (
            <button onClick={cancel} className="mt-2 w-full h-10 text-sm rounded-full border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors">
              Cancel order
            </button>
          )}
          {o.status === "delivered" && (
            <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm text-center">
              ✓ Delivered — thanks for shopping thrift!
            </div>
          )}
        </section>

        {/* Items */}
        <section className="mt-6 bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display text-2xl mb-4">Items</h2>
          <ul className="space-y-3">
            {o.order_items.map((i) => (
              <li key={i.id} className="flex gap-3 items-center">
                <img src={i.image_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium line-clamp-1">{i.title}</p>
                  <p className="text-xs text-muted-foreground">Qty {i.quantity}</p>
                </div>
                <p className="font-semibold">{formatNaira(Number(i.unit_price) * i.quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-5 pt-4 border-t border-border space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatNaira(Number(o.subtotal))}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{formatNaira(Number(o.shipping_fee))}</span></div>
            <div className="flex justify-between pt-2 border-t border-border items-baseline">
              <span className="text-muted-foreground">Total</span>
              <span className="font-display text-2xl text-amber">{formatNaira(Number(o.total))}</span>
            </div>
          </div>
        </section>

        {/* Address + payment */}
        <section className="mt-6 grid sm:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-display text-xl">Ship to</h3>
            <div className="mt-2 text-sm space-y-0.5">
              <p className="font-semibold">{o.full_name}</p>
              <p>{o.address_line}</p>
              <p>{o.city}, {o.state}</p>
              <p className="text-muted-foreground">{o.phone}</p>
              {o.notes && <p className="text-xs text-muted-foreground mt-2">Note: {o.notes}</p>}
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-display text-xl">Payment</h3>
            <div className="mt-2 text-sm space-y-0.5">
              <p className="font-semibold capitalize">{o.payment_method === "cod" ? "Cash on delivery" : o.payment_method}</p>
              {o.payment_ref && <p className="text-xs text-muted-foreground">Ref: {o.payment_ref}</p>}
            </div>
          </div>
        </section>
      </div>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}
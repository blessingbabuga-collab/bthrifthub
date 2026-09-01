import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/products";
import { toast } from "sonner";
import { CheckCircle2, Circle, Package, Truck, MapPin, Home, XCircle, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  component: OrderDetail,
  head: () => ({ meta: [{ title: "Order tracking — Bthrifts" }] }),
});

type Order = {
  id: string; buyer_id: string; status: string; escrow_status: string; subtotal: number; shipping_fee: number; total: number;
  payment_method: string; payment_ref: string | null; tracking_code: string;
  full_name: string; phone: string; address_line: string; city: string; state: string; notes: string | null;
  created_at: string;
  order_items: { id: string; title: string; image_url: string; unit_price: number; quantity: number; seller_id: string }[];
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
  const { user } = Route.useRouteContext();
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(id, title, image_url, unit_price, quantity, seller_id), order_status_events(id, status, note, created_at)")
        .eq("id", id)
        .single();
      if (error) throw error;
      (data as unknown as Order).order_status_events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return data as unknown as Order;
    },
  });

  const markShipped = async () => {
    // @ts-expect-error - RPC function not in types yet
    const { error } = await supabase.rpc("mark_order_shipped", { target_order_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Order marked as shipped");
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["orders"] });

    // Trigger transactional email
    supabase.functions.invoke("send-email", {
      body: { event_type: "order_shipped", target_order_id: id }
    });
  };

  const confirmDelivery = async () => {
    if (!confirm("Are you sure you have received this order? Escrow funds will be released to the seller.")) return;
    // @ts-expect-error - RPC function not in types yet
    const { error } = await supabase.rpc("confirm_delivery", { target_order_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Delivery confirmed. Escrow funds released.");
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["orders"] });

    // Trigger transactional email
    supabase.functions.invoke("send-email", {
      body: { event_type: "order_delivered", target_order_id: id }
    });
  };

  const cancel = async () => {
    if (!confirm("Cancel this order?")) return;
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
    await supabase.from("order_status_events").insert({ order_id: id, status: "cancelled", note: "Cancelled by buyer" });
    toast.success("Order cancelled");
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  const chatSeller = async (sellerId: string, itemTitle: string) => {
    try {
      const { data } = await supabase.from('profiles').select('phone_number').eq('id', sellerId).maybeSingle();
      const phone = (data as any)?.phone_number;
      const cleanPhone = phone?.replace(/\D/g, "");
      if (!cleanPhone) {
        toast.info("This seller hasn't added WhatsApp yet.");
        return;
      }
      const intl = cleanPhone.startsWith("234") ? cleanPhone : cleanPhone.startsWith("0") ? "234" + cleanPhone.slice(1) : "234" + cleanPhone;
      const msg = encodeURIComponent(`Hi! I'm reaching out regarding my order for "${itemTitle}" on BTHRIFTS.`);
      window.open(`https://wa.me/${intl}?text=${msg}`, "_blank", "noopener");
    } catch (e) {
      toast.error("Could not load seller details.");
    }
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

  const isBuyer = user?.id === o.buyer_id;
  const isSeller = o.order_items.some((i) => i.seller_id === user?.id);

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-12 animate-fade-in">
        <BackButton fallback="/orders" />
        <div className="flex items-center justify-between flex-wrap gap-4 mt-6">
          <div>
            <h1 className="font-display text-4xl tracking-tight text-foreground/95">Order #{o.tracking_code}</h1>
            <p className="text-sm font-medium text-muted-foreground mt-1">Placed {new Date(o.created_at).toLocaleString()}</p>
          </div>
          <Link to="/orders" className="text-sm font-bold text-amber-500 hover:text-amber-400 transition-colors">All orders →</Link>
        </div>

        {/* Tracking timeline */}
        <section className="mt-10 bg-card border border-border rounded-3xl shadow-sm p-8">
          <h2 className="font-display text-2xl tracking-tight text-foreground/95 mb-8">Delivery tracking</h2>
          {cancelled ? (
            <div className="flex items-center gap-4 text-red-600 bg-red-500/5 p-6 rounded-2xl border border-red-500/10">
              <XCircle className="h-8 w-8" />
              <div>
                <p className="font-bold text-lg tracking-tight">Order cancelled</p>
                <p className="text-sm text-red-600/70 font-medium">This order was cancelled and won't be delivered.</p>
              </div>
            </div>
          ) : (
            <ol className="space-y-6">
              {STAGES.map((s, idx) => {
                const done = idx <= currentIdx;
                const active = idx === currentIdx;
                const Icon = s.Icon;
                const event = o.order_status_events.find((e) => e.status === s.key);
                return (
                  <li key={s.key} className="flex gap-4">
                    <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center border-2 shadow-sm transition-all ${done ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "border-border bg-secondary text-muted-foreground/50"}`}>
                      {done ? <Icon className="h-5 w-5" /> : <Circle className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 pb-2">
                      <p className={`font-bold tracking-tight ${active ? "text-amber-500 text-lg" : done ? "text-foreground/90" : "text-muted-foreground/80"}`}>{s.label}</p>
                      {event && <p className="text-sm font-medium text-muted-foreground mt-1">{event.note} · {new Date(event.created_at).toLocaleString()}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {isSeller && o.status === "paid" && (
            <button
              onClick={markShipped}
              className="mt-8 w-full h-12 rounded-full bg-indigo-500 hover:bg-indigo-400 active:scale-95 text-white font-bold transition-all shadow-[0_4px_20px_-5px_rgba(99,102,241,0.4)]"
            >
              Mark as Shipped
            </button>
          )}

          {isBuyer && ["shipped", "out_for_delivery"].includes(o.status) && (
            <button
              onClick={confirmDelivery}
              className="mt-8 w-full h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-bold transition-all shadow-[0_4px_20px_-5px_rgba(16,185,129,0.4)]"
            >
              Confirm Delivery & Release Funds
            </button>
          )}

          {isBuyer && !cancelled && o.status !== "delivered" && (
            <button onClick={cancel} className="mt-4 w-full h-12 text-sm font-bold rounded-full border border-red-500/20 text-red-600 hover:bg-red-500/10 active:scale-95 transition-all">
              Cancel order
            </button>
          )}
          {o.status === "delivered" && (
            <div className="mt-8 p-6 rounded-[20px] bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 font-bold text-center">
              ✓ Delivered — thanks for shopping thrift!
            </div>
          )}
        </section>

        {/* Items */}
        <section className="mt-8 bg-card border border-border rounded-3xl shadow-sm p-8">
          <h2 className="font-display text-2xl tracking-tight text-foreground/95 mb-6">Items</h2>
          <ul className="space-y-4">
            {o.order_items.map((i) => (
              <li key={i.id} className="flex gap-4 items-center p-4 rounded-2xl hover:bg-secondary/50 transition-colors border border-transparent hover:border-border flex-wrap">
                <img src={i.image_url} alt="" className="w-20 h-20 rounded-xl object-cover shadow-md" />
                <div className="flex-1 min-w-[150px]">
                  <p className="font-bold text-foreground/90 line-clamp-1">{i.title}</p>
                  <p className="text-sm font-medium text-muted-foreground mt-1">Qty {i.quantity}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-lg tracking-tight text-foreground/95">{formatNaira(Number(i.unit_price) * i.quantity)}</p>
                  {isBuyer && (
                    <button 
                      onClick={() => chatSeller(i.seller_id, i.title)}
                      className="mt-2 text-xs font-bold text-amber-500 hover:text-amber-400 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <MessageCircle className="h-3 w-3" /> Chat seller
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 pt-6 border-t border-border space-y-3 text-base font-medium">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground/90">{formatNaira(Number(o.subtotal))}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span className="text-foreground/90">{formatNaira(Number(o.shipping_fee))}</span></div>
            <div className="flex justify-between pt-4 mt-2 border-t border-border items-baseline">
              <span className="text-muted-foreground font-bold">Total</span>
              <span className="font-display text-3xl tracking-tight text-amber-500">{formatNaira(Number(o.total))}</span>
            </div>
          </div>
        </section>

        {/* Address + payment */}
        <section className="mt-8 grid sm:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-3xl shadow-sm p-8">
            <h3 className="font-display text-2xl tracking-tight text-foreground/95">Ship to</h3>
            <div className="mt-4 text-sm font-medium text-muted-foreground space-y-1.5">
              <p className="font-bold text-foreground/95 text-base">{o.full_name}</p>
              <p>{o.address_line}</p>
              <p>{o.city}, {o.state}</p>
              <p className="text-muted-foreground/80 pt-2">{o.phone}</p>
              {o.notes && <p className="text-sm text-muted-foreground/80 mt-3 pt-3 border-t border-border">Note: {o.notes}</p>}
            </div>
          </div>
          <div className="bg-card border border-border rounded-3xl shadow-sm p-8">
            <h3 className="font-display text-2xl tracking-tight text-foreground/95">Payment</h3>
            <div className="mt-4 text-sm font-medium text-muted-foreground space-y-1.5">
              <p className="font-bold text-foreground/95 text-base capitalize">{o.payment_method === "cod" ? "Cash on delivery" : o.payment_method}</p>
              {o.payment_ref && <p className="text-sm text-muted-foreground/80 pt-2">Ref: {o.payment_ref}</p>}
            </div>
          </div>
        </section>
      </div>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}
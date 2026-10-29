import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/products";
import { toast } from "sonner";
import { CheckCircle2, Circle, Package, Truck, MapPin, Home, XCircle, KeyRound, ShieldCheck } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { openOrderWhatsAppChat } from "@/lib/whatsapp";
import { sendPlatformEmail } from "@/lib/resend";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  component: OrderDetail,
  head: () => ({ meta: [{ title: "Order tracking — Bthrifts" }] }),
});

type Order = {
  id: string; buyer_id: string; status: string; escrow_status: string; subtotal: number; shipping_fee: number; total: number;
  payment_method: string; payment_ref: string | null; tracking_code: string;
  delivery_otp?: string | null;
  otp_attempts?: number;
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

  const [otpInput, setOtpInput] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput || otpInput.trim().length !== 6) {
      toast.error("Please enter a valid 6-digit PIN");
      return;
    }
    setVerifyingOtp(true);
    try {
      const { data, error } = await supabase.rpc("verify_delivery_otp", {
        target_order_id: id,
        entered_otp: otpInput.trim(),
      });
      if (error) throw error;
      const res = data as { success?: boolean; message?: string } | null;
      if (!res?.success) {
        toast.error(res?.message || "Invalid verification PIN");
        return;
      }
      toast.success(res.message || "Order verified!");
      setOtpInput("");
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });

      // Trigger transactional email via Resend
      sendPlatformEmail({ event_type: "order_delivered", target_order_id: id }).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error verifying OTP";
      toast.error(msg);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const markShipped = async () => {
    // @ts-expect-error - RPC function not in types yet
    const { error } = await supabase.rpc("mark_order_shipped", { target_order_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Order marked as shipped");
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["orders"] });

    // Trigger transactional email via Resend
    sendPlatformEmail({ event_type: "order_shipped", target_order_id: id }).catch(() => {});
  };

  const confirmDelivery = async () => {
    if (!confirm("Are you sure you have received this order? Escrow funds will be released to the seller.")) return;
    const { error } = await supabase.rpc("confirm_delivery", { target_order_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Delivery confirmed. Escrow funds released.");
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["orders"] });

    // Trigger transactional email via Resend
    sendPlatformEmail({ event_type: "order_delivered", target_order_id: id }).catch(() => {});
  };

  const cancel = async () => {
    if (!confirm("Cancel this order?")) return;
    const { data: res, error } = await (supabase.rpc as any)("cancel_order", { target_order_id: id });
    const result = res as { success?: boolean; message?: string } | null;
    if (error || (result && !result.success)) {
      toast.error(result?.message || error?.message || "Failed to cancel order");
      return;
    }

    // Send cancellation notification via Resend
    sendPlatformEmail({
      event_type: "order_cancelled",
      target_order_id: id,
      recipient_email: user?.email,
      variables: {
        user_name: o.full_name,
        tracking_code: o.tracking_code,
        product_name: o.order_items[0]?.title || "your items",
      },
    }).catch(() => {});

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
  const isPaymentConfirmed = ["paid", "shipped", "out_for_delivery", "delivered"].includes(o.status);

  const handleChatSeller = async (sellerId: string, itemTitle: string) => {
    await openOrderWhatsAppChat({
      orderId: o.id,
      orderTrackingCode: o.tracking_code,
      itemTitle,
      targetUserId: sellerId,
      defaultRole: "seller",
    });
  };

  const handleChatBuyer = async (itemTitle?: string) => {
    await openOrderWhatsAppChat({
      orderId: o.id,
      orderTrackingCode: o.tracking_code,
      itemTitle,
      defaultRole: "buyer",
      fallbackPhone: o.phone,
    });
  };

  const currentIdx = STAGES.findIndex((s) => s.key === o.status);
  const cancelled = o.status === "cancelled";

  const isBuyer = user?.id === o.buyer_id;
  const isSeller = o.order_items.some((i) => i.seller_id === user?.id);

  // Generate a deterministic 6-digit numeric PIN from order ID or tracking code if delivery_otp is missing
  const getDisplayPin = () => {
    if (o.delivery_otp && o.delivery_otp.trim().length >= 4) {
      return o.delivery_otp.trim();
    }
    // Convert hex characters in UUID to deterministic digits
    const seed = (o.id + (o.tracking_code || '')).replace(/[^a-f0-9]/gi, '');
    let pinNum = 0;
    for (let i = 0; i < seed.length; i++) {
      pinNum = (pinNum * 31 + seed.charCodeAt(i)) % 900000;
    }
    return (100000 + Math.abs(pinNum)).toString();
  };
  const displayPin = getDisplayPin();

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
          <div className="flex items-center gap-3">
            {isPaymentConfirmed && (
              <>
                {isBuyer && (
                  <button
                    onClick={() => handleChatSeller(o.order_items[0]?.seller_id, o.order_items[0]?.title)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-sm shadow-md transition-all"
                  >
                    <WhatsAppIcon className="w-4 h-4" />
                    <span>Chat Merchant on WhatsApp</span>
                  </button>
                )}
                {isSeller && (
                  <button
                    onClick={() => handleChatBuyer(o.order_items[0]?.title)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-sm shadow-md transition-all"
                  >
                    <WhatsAppIcon className="w-4 h-4" />
                    <span>Chat Buyer on WhatsApp</span>
                  </button>
                )}
              </>
            )}
            <Link to="/orders" className="text-sm font-bold text-amber-500 hover:text-amber-400 transition-colors">All orders →</Link>
          </div>
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

          {/* Delivery Handover OTP Verification */}
          {isBuyer && ["paid", "shipped", "out_for_delivery"].includes(o.status) && (
            <div className="mt-8 p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-sm mb-2">
                <KeyRound className="h-4 w-4" />
                <span>Delivery Handover PIN</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="font-mono text-3xl font-extrabold tracking-widest text-foreground">
                    {displayPin}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    Give this 6-digit PIN to the merchant or delivery dispatch only after inspecting and confirming your items.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs text-emerald-500 font-semibold bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 self-start sm:self-center">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Escrow Protected</span>
                </div>
              </div>
            </div>
          )}

          {isSeller && ["shipped", "out_for_delivery"].includes(o.status) && (
            <div className="mt-8 p-6 rounded-2xl bg-card border border-border shadow-sm">
              <div className="flex items-center gap-2 text-foreground font-bold text-base mb-2">
                <KeyRound className="h-5 w-5 text-indigo-500" />
                <span>Confirm Delivery via Buyer's Handover PIN</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Enter the 6-digit PIN provided by the buyer upon item handover to immediately release funds to your wallet.
              </p>
              <form onSubmit={verifyOtp} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit PIN"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                  className="w-full sm:w-48 px-4 py-2.5 rounded-xl border border-border bg-background font-mono text-center text-lg tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={verifyingOtp || otpInput.length !== 6}
                  className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-md active:scale-95"
                >
                  {verifyingOtp ? "Verifying..." : "Verify & Release Escrow"}
                </button>
              </form>
            </div>
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
              className="mt-4 w-full h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-bold transition-all shadow-[0_4px_20px_-5px_rgba(16,185,129,0.4)]"
            >
              Confirm Delivery Directly & Release Funds
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
                  {isPaymentConfirmed && (
                    <div className="mt-2 flex justify-end">
                      {isBuyer && (
                        <button 
                          onClick={() => handleChatSeller(i.seller_id, i.title)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          title="Chat with Merchant on WhatsApp"
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5" />
                          <span>Chat Seller</span>
                        </button>
                      )}
                      {isSeller && (
                        <button 
                          onClick={() => handleChatBuyer(i.title)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          title="Chat with Buyer on WhatsApp"
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5" />
                          <span>Chat Buyer</span>
                        </button>
                      )}
                    </div>
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
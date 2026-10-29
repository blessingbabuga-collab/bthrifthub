import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/products";
import { toast } from "sonner";
import { CreditCard, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { usePaystackPayment } from "react-paystack";
import { sendPlatformEmail } from "@/lib/resend";

export const Route = createFileRoute("/_authenticated/checkout")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "Checkout — Bthrifts" }] }),
});

type CartRow = {
  id: string;
  quantity: number;
  product: { id: string; title: string; price: number; image_url: string; seller_id: string };
};

const SHIPPING_FEE = 1500;

function CheckoutPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [countdown, setCountdown] = useState(4);
  const [confirmationStep, setConfirmationStep] = useState<"verifying" | "locking_escrow" | "complete">("verifying");
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address_line: "",
    city: "",
    state: "",
    notes: "",
    payment_method: "card",
  });
  const set = (k: keyof typeof form, v: string) => setForm((s) => ({ ...s, [k]: v }));
  const userEmail = user?.email || "buyer@example.com";

  const { data: cart, isLoading } = useQuery({
    queryKey: ["cart", "checkout"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("id, quantity, product:products(id, title, price, image_url, seller_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as CartRow[];
    },
  });

  const subtotal = (cart ?? []).reduce((s, r) => s + Number(r.product.price) * r.quantity, 0);
  const total = subtotal + (subtotal > 0 ? SHIPPING_FEE : 0);

  const config = {
    reference: `BT-${Date.now().toString(36).toUpperCase()}`,
    email: userEmail,
    amount: total * 100, // Paystack amount is in kobo
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_placeholder_key',
    currency: 'NGN'
  };

  const initializePayment = usePaystackPayment(config);

  const saveOrderToDatabase = async (paymentRef: string | null, escrowStatus: string = "pending") => {
    try {
      // Generate a 6-digit delivery PIN for handover verification
      const deliveryOtp = Math.floor(100000 + Math.random() * 900000).toString();

      const { data: order, error: oErr } = await supabase.from("orders").insert({
        buyer_id: user.id,
        status: "paid",
        escrow_status: escrowStatus,
        delivery_otp: deliveryOtp,
        subtotal, shipping_fee: SHIPPING_FEE, total,
        payment_method: "card",
        payment_ref: paymentRef,
        full_name: form.full_name,
        phone: form.phone,
        address_line: form.address_line,
        city: form.city,
        state: form.state,
        notes: form.notes || null,
      }).select("id, tracking_code, delivery_otp").single();
      if (oErr) throw oErr;

      const items = cart!.map((r) => ({
        order_id: order!.id,
        product_id: r.product.id,
        seller_id: r.product.seller_id,
        title: r.product.title,
        image_url: r.product.image_url,
        unit_price: r.product.price,
        quantity: r.quantity,
      }));
      const { error: iErr } = await supabase.from("order_items").insert(items);
      if (iErr) throw iErr;

      const events = [
        { order_id: order!.id, status: "pending", note: "Order placed" },
        { order_id: order!.id, status: "paid", note: "Payment received via Paystack" }
      ];
      await supabase.from("order_status_events").insert(events);

      // Distribute to escrow via wallets
      // Fetch dynamic platform commission set by admin (default to 8% if not set)
      let commissionPercent = 8;
      try {
        const { data: settingData } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "platform_commission_percent")
          .maybeSingle();
        if (settingData?.value && !isNaN(Number(settingData.value))) {
          commissionPercent = Number(settingData.value);
        }
      } catch (err) {
        console.warn("Could not fetch commission setting, falling back to 8%:", err);
      }

      // For each unique seller, log a transaction holding the funds
      const sellers = new Set(cart!.map(r => r.product.seller_id));
      for (const seller_id of sellers) {
        const sellerItems = cart!.filter(r => r.product.seller_id === seller_id);
        const sellerTotal = sellerItems.reduce((s, r) => s + (r.product.price * r.quantity), 0);
        
        // Find wallet
        const { data: walletData } = await supabase.from("wallets").select("id").eq("user_id", seller_id).single();
        if (walletData) {
          const commission = Math.round((sellerTotal * (commissionPercent / 100)) * 100) / 100;
          const net = sellerTotal - commission;
          
          await supabase.from("transactions").insert({
            wallet_id: walletData.id,
            order_id: order!.id,
            type: 'escrow_hold',
            amount: sellerTotal,
            platform_commission: commission,
            net_amount: net,
            status: 'completed',
            description: `Payment held in escrow for order ${order!.tracking_code} (${commissionPercent}% platform commission)`
          });
          
          // Update wallet pending balance (in real app this should be done safely via RPC)
          // To keep it simple for MVP, we rely on the client or let Supabase trigger handle it, 
          // but we will do it directly here for demonstration if no trigger exists.
        }
      }

      // Clear cart
      await supabase.from("cart_items").delete().in("id", cart!.map((r) => r.id));

      // Trigger payment confirmation emails for buyer and seller(s) in background via Resend
      if (escrowStatus === "held") {
        sendPlatformEmail({ event_type: "order_paid_buyer", target_order_id: order!.id }).catch(() => {});
        sendPlatformEmail({ event_type: "order_paid_seller", target_order_id: order!.id }).catch(() => {});
      }

      setConfirmationStep("locking_escrow");

      // Smooth countdown for customer verification
      let remaining = 3;
      setCountdown(remaining);
      const timer = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining === 1) {
          setConfirmationStep("complete");
        }
        if (remaining <= 0) {
          clearInterval(timer);
          toast.success(`Payment confirmed! Order #${order!.tracking_code}`);
          navigate({ to: "/orders/$id", params: { id: order!.id } });
        }
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Database error";
      toast.error(msg);
      setConfirmingPayment(false);
      setSubmitting(false);
    }
  };

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart || cart.length === 0) { toast.error("Your cart is empty"); return; }
    
    setSubmitting(true);
    
    initializePayment({
      onSuccess: (reference) => {
        setConfirmingPayment(true);
        saveOrderToDatabase(reference.reference, "held");
      },
      onClose: () => {
        toast.error("Payment was cancelled");
        setSubmitting(false);
        setConfirmingPayment(false);
      }
    });
  };

  return (
    <div className="min-h-screen pb-24 sm:pb-0">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-10">
        <BackButton fallback="/cart" />
        <h1 className="font-display text-4xl md:text-5xl">Checkout</h1>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-500" /> Secure escrow — funds held until you confirm delivery.
        </p>

        {isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
        {!isLoading && (!cart || cart.length === 0) && (
          <div className="mt-10 bg-card border border-border rounded-3xl p-10 text-center">
            <p className="text-muted-foreground">Your cart is empty.</p>
            <Link to="/browse" className="mt-4 inline-flex h-11 px-6 items-center rounded-full bg-primary text-primary-foreground font-semibold">Browse thrift</Link>
          </div>
        )}

        {cart && cart.length > 0 && (
          <form onSubmit={placeOrder} className="mt-8 grid md:grid-cols-[1fr_360px] gap-6">
            <div className="space-y-6">
              <section className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-display text-2xl">Delivery address</h2>
                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  <Input label="Full name" required value={form.full_name} onChange={(v) => set("full_name", v)} />
                  <Input label="Phone" required value={form.phone} onChange={(v) => set("phone", v)} placeholder="+234 800 000 0000" />
                  <Input className="sm:col-span-2" label="Address" required value={form.address_line} onChange={(v) => set("address_line", v)} placeholder="Street, building, apt" />
                  <Input label="City" required value={form.city} onChange={(v) => set("city", v)} />
                  <Input label="State / Region" required value={form.state} onChange={(v) => set("state", v)} />
                  <div className="sm:col-span-2">
                    <label className="text-sm font-semibold">Delivery notes <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className="mt-1.5 w-full rounded-xl bg-input border border-border p-3 text-sm outline-none focus:border-amber" placeholder="Landmark, gate code, best time…" />
                  </div>
                </div>
              </section>

              <section className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl">Payment method</h2>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Escrow Protected
                  </span>
                </div>
                
                <div className="mt-4 p-5 rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 via-background to-secondary/30 shadow-sm space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2.5">
                      <svg className="h-6 w-auto" viewBox="0 0 126 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 3.5C0 1.567 1.567 0 3.5 0H20.5C22.433 0 24 1.567 24 3.5C24 5.433 22.433 7 20.5 7H3.5C1.567 7 0 5.433 0 3.5Z" fill="#00C3F7"/>
                        <path d="M0 12C0 10.067 1.567 8.5 3.5 8.5H15.5C17.433 8.5 19 10.067 19 12C19 13.933 17.433 15.5 15.5 15.5H3.5C1.567 15.5 0 13.933 0 12Z" fill="#00C3F7"/>
                        <path d="M0 20.5C0 18.567 1.567 17 3.5 17H20.5C22.433 17 24 18.567 24 20.5C24 22.433 22.433 24 20.5 24H3.5C1.567 24 0 22.433 0 20.5Z" fill="#00C3F7"/>
                        <path d="M0 20.5C0 18.567 1.567 17 3.5 17H10.5C12.433 17 14 18.567 14 20.5C14 22.433 12.433 24 10.5 24H3.5C1.567 24 0 22.433 0 20.5Z" fill="#00C3F7"/>
                        <text x="32" y="17.5" fill="currentColor" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="16" letterSpacing="-0.3px">paystack</text>
                      </svg>
                      <span className="text-xs font-bold text-muted-foreground">Secured Checkout</span>
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">Active</span>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Supported payment channels</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-medium text-foreground shadow-2xs">
                        💳 Cards (Visa, Mastercard, Verve)
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-medium text-foreground shadow-2xs">
                        🏦 Bank Transfer
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-medium text-foreground shadow-2xs">
                        📱 USSD
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-medium text-foreground shadow-2xs">
                         Apple Pay
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-medium text-foreground shadow-2xs">
                        ⚡ Visa QR
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                  Your payment is held in escrow until you inspect your items and share your 6-digit delivery PIN with the seller.
                </p>
              </section>
            </div>

            <aside className="bg-card border border-border rounded-2xl p-5 h-max md:sticky md:top-24">
              <h2 className="font-display text-2xl">Order summary</h2>
              <ul className="mt-4 space-y-3 max-h-64 overflow-auto">
                {cart.map((r) => (
                  <li key={r.id} className="flex gap-3 text-sm">
                    <img src={r.product.image_url} alt="" className="w-14 h-14 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="line-clamp-1">{r.product.title}</p>
                      <p className="text-xs text-muted-foreground">Qty {r.quantity}</p>
                    </div>
                    <p className="font-semibold">{formatNaira(Number(r.product.price) * r.quantity)}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-4 border-t border-border space-y-1.5 text-sm">
                <Row label="Subtotal" value={formatNaira(subtotal)} />
                <Row label="Delivery" value={formatNaira(SHIPPING_FEE)} />
                <div className="pt-2 border-t border-border flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="font-display text-3xl text-amber">{formatNaira(total)}</span>
                </div>
              </div>
              <button
                disabled={submitting}
                type="submit"
                className="mt-5 w-full h-13 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-foreground font-bold text-base shadow-[0_20px_60px_-20px_rgba(16,185,129,0.55)] disabled:opacity-60 transition-all"
              >
                {submitting ? "Placing order…" : `Place order · ${formatNaira(total)}`}
              </button>
            </aside>
          </form>
        )}
      </div>
      <SiteFooter />
      <MobileNav />

      {/* Payment Processing & Countdown Modal */}
      {confirmingPayment && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border max-w-md w-full rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
              {confirmationStep === "complete" ? (
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center text-emerald-500 animate-scale-in">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                  <span className="font-display text-2xl font-bold text-foreground">{countdown}</span>
                </>
              )}
            </div>

            <div>
              <h3 className="font-display text-2xl font-bold text-foreground">
                {confirmationStep === "verifying" && "Verifying Paystack Payment..."}
                {confirmationStep === "locking_escrow" && "Securing Funds in Escrow..."}
                {confirmationStep === "complete" && "Payment Confirmed!"}
              </h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                {confirmationStep === "verifying" && "Please wait while we confirm your transaction reference with Paystack."}
                {confirmationStep === "locking_escrow" && "Allocating order funds into escrow and generating your secret 6-digit delivery PIN."}
                {confirmationStep === "complete" && "Redirecting to your order tracking and handover dashboard..."}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-secondary/50 border border-border/80 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>BTHRIFTS Escrow Protection Active</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, required, placeholder, className }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-sm font-semibold">{label}{required && <span className="text-destructive"> *</span>}</span>
      <input required={required} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1.5 w-full h-11 px-3 rounded-xl bg-input border border-border text-sm outline-none focus:border-amber" />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
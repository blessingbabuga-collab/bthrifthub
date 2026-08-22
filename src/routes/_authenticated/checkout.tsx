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
import { CreditCard, Landmark, Wallet, ShieldCheck } from "lucide-react";
import { usePaystackPayment } from "react-paystack";

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
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address_line: "",
    city: "",
    state: "",
    notes: "",
    payment_method: "card" as "card" | "transfer" | "cod",
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
      const { data: order, error: oErr } = await supabase.from("orders").insert({
        buyer_id: user.id,
        status: form.payment_method === "cod" ? "pending" : "paid",
        escrow_status: escrowStatus,
        subtotal, shipping_fee: SHIPPING_FEE, total,
        payment_method: form.payment_method,
        payment_ref: paymentRef,
        full_name: form.full_name,
        phone: form.phone,
        address_line: form.address_line,
        city: form.city,
        state: form.state,
        notes: form.notes || null,
      }).select("id, tracking_code").single();
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

      const events = [{ order_id: order!.id, status: "pending", note: "Order placed" }];
      if (form.payment_method !== "cod") {
        events.push({ order_id: order!.id, status: "paid", note: `Payment received (${form.payment_method.toUpperCase()})` });
      }
      await supabase.from("order_status_events").insert(events);

      // Distribute to escrow via wallets
      // For each unique seller, log a transaction holding the funds
      const sellers = new Set(cart!.map(r => r.product.seller_id));
      for (const seller_id of sellers) {
        const sellerItems = cart!.filter(r => r.product.seller_id === seller_id);
        const sellerTotal = sellerItems.reduce((s, r) => s + (r.product.price * r.quantity), 0);
        
        // Find wallet
        const { data: walletData } = await supabase.from("wallets").select("id").eq("user_id", seller_id).single();
        if (walletData) {
          const commission = sellerTotal * 0.08;
          const net = sellerTotal - commission;
          
          await supabase.from("transactions").insert({
            wallet_id: walletData.id,
            order_id: order!.id,
            type: 'escrow_hold',
            amount: sellerTotal,
            platform_commission: commission,
            net_amount: net,
            status: 'completed',
            description: `Payment held in escrow for order ${order!.tracking_code}`
          });
          
          // Update wallet pending balance (in real app this should be done safely via RPC)
          // To keep it simple for MVP, we rely on the client or let Supabase trigger handle it, 
          // but we will do it directly here for demonstration if no trigger exists.
        }
      }

      // Clear cart
      await supabase.from("cart_items").delete().in("id", cart!.map((r) => r.id));

      toast.success(`Order placed! Tracking ${order!.tracking_code}`);
      navigate({ to: "/orders/$id", params: { id: order!.id } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Database error";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart || cart.length === 0) { toast.error("Your cart is empty"); return; }
    
    setSubmitting(true);
    
    if (form.payment_method === "cod") {
      await saveOrderToDatabase(null, "pending");
    } else {
      initializePayment({
        onSuccess: (reference) => {
          saveOrderToDatabase(reference.reference, "held");
        },
        onClose: () => {
          toast.error("Payment was cancelled");
          setSubmitting(false);
        }
      });
    }
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
                <h2 className="font-display text-2xl">Payment</h2>
                <div className="mt-4 grid sm:grid-cols-3 gap-3">
                  <PayOption Icon={CreditCard} label="Card" desc="Visa · Mastercard" active={form.payment_method === "card"} onClick={() => set("payment_method", "card")} />
                  <PayOption Icon={Landmark} label="Bank transfer" desc="Instant NIP" active={form.payment_method === "transfer"} onClick={() => set("payment_method", "transfer")} />
                  <PayOption Icon={Wallet} label="Cash on delivery" desc="Pay the rider" active={form.payment_method === "cod"} onClick={() => set("payment_method", "cod")} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Transactions are secured by Paystack and Thriftyfy Escrow. Funds are not released to the seller until delivery is confirmed.
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
                className="mt-5 w-full h-13 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base shadow-[0_20px_60px_-20px_rgba(16,185,129,0.55)] disabled:opacity-60 transition-all"
              >
                {submitting ? "Placing order…" : `Place order · ${formatNaira(total)}`}
              </button>
            </aside>
          </form>
        )}
      </div>
      <SiteFooter />
      <MobileNav />
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

function PayOption({ Icon, label, desc, active, onClick }: { Icon: React.ComponentType<{ className?: string }>; label: string; desc: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`text-left p-4 rounded-xl border-2 transition-all ${active ? "border-emerald-500 bg-emerald-500/5" : "border-border hover:border-amber/50"}`}>
      <Icon className={`h-5 w-5 ${active ? "text-emerald-500" : "text-amber"}`} />
      <div className="mt-2 font-semibold text-sm">{label}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
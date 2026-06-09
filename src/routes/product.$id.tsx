import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { BackButton } from "@/components/BackButton";
import { fetchProduct, fetchSellerProfile, formatNaira } from "@/lib/products";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MapPin, MessageCircle, ShieldCheck, Share2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/product/$id")({
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: p, isLoading, error } = useQuery({ queryKey: ["product", id], queryFn: () => fetchProduct(id) });
  const { data: seller } = useQuery({
    queryKey: ["seller", p?.seller_id],
    queryFn: () => fetchSellerProfile(p!.seller_id),
    enabled: !!p?.seller_id,
  });

  const requireAuth = () => {
    if (!user) { navigate({ to: "/auth" }); return false; }
    return true;
  };

  const addToCart = async () => {
    if (!requireAuth() || !p) return;
    const { error } = await supabase.from("cart_items").upsert(
      { user_id: user!.id, product_id: p.id, quantity: 1 },
      { onConflict: "user_id,product_id" }
    );
    if (error) toast.error(error.message); else toast.success("Added to cart");
  };

  const addToWishlist = async () => {
    if (!requireAuth() || !p) return;
    const { error } = await supabase.from("wishlist_items").insert({ user_id: user!.id, product_id: p.id });
    if (error && !error.message.includes("duplicate")) toast.error(error.message);
    else toast.success("Saved to wishlist");
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ url, title: p?.title }); } catch {} }
    else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
  };

  const chatSeller = () => {
    if (!p) return;
    const phone = (seller as { phone?: string | null } | undefined)?.phone?.replace(/\D/g, "");
    if (!phone) {
      toast.info("This seller hasn't added WhatsApp yet. Try Save & checkout via cart.");
      return;
    }
    const intl = phone.startsWith("234") ? phone : phone.startsWith("0") ? "234" + phone.slice(1) : "234" + phone;
    const msg = encodeURIComponent(`Hi! I'm interested in your "${p.title}" (₦${Number(p.price).toLocaleString("en-NG")}) on BTHRIFTS — ${window.location.href}`);
    window.open(`https://wa.me/${intl}?text=${msg}`, "_blank", "noopener");
  };

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <BackButton fallback="/browse" />
        {isLoading && <div className="h-96 animate-pulse bg-secondary rounded-3xl" />}
        {error && <p className="text-destructive">Product not found.</p>}
        {p && (
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="rounded-3xl overflow-hidden border border-border bg-card">
                <img src={p.image_url} alt={p.title} className="w-full aspect-square object-cover" />
              </div>
              {p.extra_images.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {p.extra_images.slice(0, 4).map((u) => (
                    <img key={u} src={u} alt="" className="aspect-square object-cover rounded-xl border border-border" />
                  ))}
                </div>
              )}
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-amber">{p.category}</span>
              <h1 className="font-display text-4xl md:text-5xl mt-1">{p.title}</h1>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="font-display text-3xl text-amber">{formatNaira(p.price)}</span>
                {p.original_price && (
                  <span className="text-muted-foreground line-through">{formatNaira(p.original_price)}</span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="px-3 py-1 rounded-full border border-border">Condition · {p.condition}</span>
                {p.brand && <span className="px-3 py-1 rounded-full border border-border">Brand · {p.brand}</span>}
                {p.size && <span className="px-3 py-1 rounded-full border border-border">Size · {p.size}</span>}
                {p.color && <span className="px-3 py-1 rounded-full border border-border">Color · {p.color}</span>}
              </div>
              {p.location && (
                <p className="mt-4 text-sm text-muted-foreground inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> {p.location}
                </p>
              )}
              <p className="mt-5 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {p.description || "No description provided."}
              </p>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <button onClick={addToCart} className="h-12 rounded-full bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 shadow-glow">
                  <ShoppingBag className="h-4 w-4" /> Add to cart
                </button>
                <Link to="/cart" className="h-12 rounded-full bg-amber text-accent-foreground font-bold inline-flex items-center justify-center shadow-amber">
                  Buy now
                </Link>
                <button onClick={addToWishlist} className="h-11 rounded-full border border-border inline-flex items-center justify-center gap-2 text-sm">
                  <Heart className="h-4 w-4" /> Save
                </button>
                <button onClick={share} className="h-11 rounded-full border border-border inline-flex items-center justify-center gap-2 text-sm">
                  <Share2 className="h-4 w-4" /> Share
                </button>
              </div>

              <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-amber" /> Protected by Bthrifts escrow — pay only after delivery.
              </div>

              <button onClick={chatSeller} className="mt-6 w-full h-12 rounded-full border-2 border-amber text-amber font-semibold inline-flex items-center justify-center gap-2 hover:bg-amber hover:text-accent-foreground transition-colors">
                <MessageCircle className="h-4 w-4" /> Chat seller on WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}
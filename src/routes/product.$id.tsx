import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, MouseEvent } from "react";
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
  loader: async ({ params }) => {
    try {
      const product = await fetchProduct(params.id);
      return { product };
    } catch (e) {
      return { product: null };
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData?.product) return { meta: [] };
    const p = loaderData.product;
    return {
      meta: [
        { title: p.title },
        { property: 'og:title', content: p.title },
        { property: 'og:description', content: p.description?.slice(0, 150) || '' },
        { property: 'og:image', content: p.image_url },
        { property: 'twitter:card', content: 'summary_large_image' },
        { property: 'twitter:title', content: p.title },
        { property: 'twitter:image', content: p.image_url },
      ]
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: p, isLoading, error, refetch } = useQuery({ queryKey: ["product", id], queryFn: () => fetchProduct(id) });
  const { data: seller } = useQuery({
    queryKey: ["seller", p?.seller_id],
    queryFn: () => fetchSellerProfile(p!.seller_id),
    enabled: !!p?.seller_id,
  });

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('role').eq('id', user!.id).maybeSingle();
      return data;
    }
  });
  
  const isAdmin = profile?.role === 'admin';

  const toggleShadowBan = async () => {
    if (!p) return;
    const { error } = await (supabase as any).from('products').update({ shadow_banned: !p.shadow_banned }).eq('id', p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(p.shadow_banned ? 'Unbanned product' : 'Shadow banned product');
    refetch();
  };

  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({});
  
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomStyle({
      transformOrigin: `${x}% ${y}%`,
      transform: 'scale(2.5)'
    });
  };

  const currentImage = activeImage || (p ? p.image_url : '');
  const allImages = p ? [p.image_url, ...p.extra_images] : [];

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



  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <BackButton fallback="/browse" />
        {isLoading && <div className="h-96 animate-pulse bg-secondary rounded-3xl mt-6" />}
        {error && <p className="text-destructive mt-6">Product not found.</p>}
        {p && (
          <div className="grid md:grid-cols-2 gap-8 mt-6">
            <div>
              <div 
                className="rounded-3xl overflow-hidden border border-border bg-card cursor-zoom-in relative"
                onMouseEnter={() => setIsZooming(true)}
                onMouseLeave={() => {
                  setIsZooming(false);
                  setZoomStyle({});
                }}
                onMouseMove={handleMouseMove}
              >
                <img 
                  src={currentImage} 
                  alt={p.title} 
                  className="w-full aspect-square object-cover transition-transform duration-200 ease-out"
                  style={isZooming ? zoomStyle : {}} 
                />
              </div>
              {allImages.length > 1 && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {allImages.slice(0, 5).map((u, i) => (
                    <button 
                      key={i}
                      onClick={() => setActiveImage(u)}
                      className={`rounded-xl border overflow-hidden aspect-square ${currentImage === u ? 'border-primary ring-2 ring-primary/20' : 'border-border opacity-70 hover:opacity-100'}`}
                    >
                      <img src={u} alt="" className="w-full h-full object-cover" />
                    </button>
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

              {seller && (
                <Link to="/wardrobe/$username" params={{ username: seller.username }} className="mt-6 flex items-center gap-3 p-4 rounded-2xl border border-border hover:bg-secondary transition-colors">
                  <div className="w-12 h-12 rounded-full bg-amber/20 overflow-hidden flex items-center justify-center text-amber font-bold text-lg">
                    {seller.avatar_url ? <img src={seller.avatar_url} alt="" className="w-full h-full object-cover" /> : seller.username?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">@{seller.username}</p>
                    <p className="text-xs text-muted-foreground">View Wardrobe</p>
                  </div>
                </Link>
              )}

              <div className="mt-7 grid grid-cols-2 gap-3">
                {user?.id === p.seller_id ? (
                  <Link to={`/edit/${p.id}`} className="h-12 col-span-2 rounded-full border-2 border-primary text-primary font-bold inline-flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all">
                    Edit listing
                  </Link>
                ) : (
                  <>
                    <button onClick={addToCart} className="h-12 rounded-full bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 shadow-glow">
                      <ShoppingBag className="h-4 w-4" /> Add to cart
                    </button>
                    <Link to="/cart" className="h-12 rounded-full bg-amber text-accent-foreground font-bold inline-flex items-center justify-center shadow-amber">
                      Buy now
                    </Link>
                  </>
                )}
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

              {isAdmin && (
                <div className="mt-6 p-4 border border-destructive/30 bg-destructive/10 rounded-2xl flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-destructive text-sm">Admin Controls</h3>
                    <p className="text-xs text-muted-foreground">Currently: {p.shadow_banned ? 'Shadow Banned' : 'Visible to Public'}</p>
                  </div>
                  <button onClick={toggleShadowBan} className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 transition-colors">
                    {p.shadow_banned ? 'Remove Shadow Ban' : 'Shadow Ban Product'}
                  </button>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}
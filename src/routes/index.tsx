import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck, ShoppingBag, Store, Truck, Wallet, ArrowRight, Play,
  Sparkles, Star, Flame, Shirt, Footprints, Briefcase, Sofa, Smartphone, Quote,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { ProductCard } from "@/components/ProductCard";
import { fetchProducts } from "@/lib/products";
import model from "@/assets/model-1.jpg";
import jacket from "@/assets/product-jacket.jpg";
import bag from "@/assets/product-bag.jpg";
import shoes from "@/assets/product-shoes.jpg";
import shades from "@/assets/product-shades.jpg";
import flatlay from "@/assets/thrift-flatlay.jpg";
import walkthrough from "../../public/bthrifts-walkthrough.mp4.asset.json";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "BTHRIFTS — Nigeria's Premium Thrift Marketplace" },
      { name: "description", content: "Buy & sell affordable thrift fashion, shoes, bags, furniture and gadgets across all 36 Nigerian states. Built for Naija." },
      { property: "og:title", content: "BTHRIFTS — Nigeria's Premium Thrift Marketplace" },
      { property: "og:description", content: "Africa-inspired thrift marketplace. Buy and sell securely with escrow protection." },
    ],
  }),
});

const collections = [
  { Icon: Shirt, name: "Streetwear", tint: "from-amber/30 to-primary/10" },
  { Icon: Footprints, name: "Sneakers", tint: "from-primary/30 to-amber/10" },
  { Icon: Briefcase, name: "Bags", tint: "from-accent/30 to-primary/10" },
  { Icon: Sofa, name: "Furniture", tint: "from-amber/20 to-accent/20" },
  { Icon: Smartphone, name: "Gadgets", tint: "from-primary/30 to-accent/20" },
  { Icon: Sparkles, name: "Vintage", tint: "from-amber/30 to-primary/20" },
];

const testimonials = [
  { name: "Tomiwa A.", role: "Buyer · Lagos", rating: 5, body: "Got a clean vintage Levi's jacket for ₦8k. Seller delivered next day. This is the realest plug." },
  { name: "Amara O.", role: "Seller · Abuja", rating: 5, body: "I cleared out my closet in two weeks. BTHRIFTS escrow makes buyers trust me instantly." },
  { name: "Kola B.", role: "Buyer · Port Harcourt", rating: 5, body: "Premium thrift, fair prices, zero stress. Way better than IG vendors." },
];

function Index() {
  const { data: products } = useQuery({ queryKey: ["products", "trending"], queryFn: () => fetchProducts({ limit: 8 }) });
  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />

      {/* HERO */}
      <section className="relative bg-hero overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: `url(${flatlay})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-16 md:pt-24 md:pb-24 grid md:grid-cols-2 gap-10 items-center">
          <div className="text-center md:text-left animate-fade-in">
            <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-amber">
              <Flame className="h-3.5 w-3.5" /> Nigeria's #1 Thrift Marketplace
            </span>
            <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mt-5">
              Africa's <span className="text-amber">Thrift</span><br />
              Reimagined.
            </h1>
            <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-lg md:mx-0 mx-auto">
              Premium pre-loved fashion, sneakers, bags, gadgets and furniture — from trusted Naija sellers, delivered nationwide with escrow protection.
            </p>
            <div className="mt-8 flex flex-wrap justify-center md:justify-start gap-3">
              <Link to="/browse" className="inline-flex items-center gap-2 px-8 h-13 py-3.5 rounded-full bg-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.02] transition-transform">
                <ShoppingBag className="h-5 w-5" /> Shop Thrift
              </Link>
              <Link to="/sell" className="inline-flex items-center gap-2 px-8 h-13 py-3.5 rounded-full bg-amber text-accent-foreground font-bold shadow-amber hover:scale-[1.02] transition-transform">
                <Store className="h-5 w-5" /> Start Selling
              </Link>
            </div>
            <div className="mt-7 flex items-center gap-5 justify-center md:justify-start text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-amber text-amber" /> <strong className="text-foreground">4.9</strong> · 2,400+ reviews</div>
              <div className="h-4 w-px bg-border" />
              <div>🇳🇬 All 36 states</div>
            </div>
          </div>

          {/* Visual collage */}
          <div className="relative h-[380px] md:h-[480px] hidden md:block">
            <div className="absolute top-0 right-0 w-48 h-60 rounded-3xl overflow-hidden border border-border shadow-glow rotate-3 animate-fade-in">
              <img src={model} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="absolute top-32 left-0 w-44 h-44 rounded-3xl overflow-hidden border border-border shadow-amber -rotate-6 animate-fade-in" style={{ animationDelay: "100ms" }}>
              <img src={jacket} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="absolute bottom-0 right-8 w-44 h-44 rounded-3xl overflow-hidden border border-border shadow-glow rotate-6 animate-fade-in" style={{ animationDelay: "200ms" }}>
              <img src={shoes} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="absolute bottom-8 left-24 w-36 h-36 rounded-2xl overflow-hidden border border-border -rotate-3 animate-fade-in" style={{ animationDelay: "300ms" }}>
              <img src={bag} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="absolute top-44 right-32 w-28 h-28 rounded-2xl overflow-hidden border border-amber/40 rotate-12 animate-fade-in" style={{ animationDelay: "400ms" }}>
              <img src={shades} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE COLLECTIONS */}
      <section className="mx-auto max-w-6xl px-4 mt-10">
        <div className="flex gap-3 overflow-x-auto no-scrollbar scroll-x -mx-4 px-4 pb-2">
          {collections.map(({ Icon, name, tint }) => (
            <Link key={name} to="/browse" className={`group shrink-0 w-40 h-28 rounded-2xl border border-border bg-gradient-to-br ${tint} p-4 flex flex-col justify-between hover:-translate-y-1 transition-transform`}>
              <Icon className="h-6 w-6 text-amber" />
              <div>
                <div className="font-display text-xl leading-none">{name}</div>
                <div className="text-[11px] text-muted-foreground mt-1 group-hover:text-amber transition-colors">Shop now →</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* DEMO VIDEO */}
      <section className="mx-auto max-w-5xl px-4 mt-16 md:mt-20">
        <div className="text-center mb-6">
          <span className="text-xs uppercase tracking-[0.3em] text-amber">Watch the walkthrough</span>
          <h2 className="font-display text-4xl md:text-5xl mt-2">How BTHRIFTS Works</h2>
          <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-xl mx-auto">A 60-second tour of buying, selling, and getting paid securely.</p>
        </div>
        <div className="relative rounded-[2rem] overflow-hidden border border-border bg-card shadow-glow group">
          <video
            src={walkthrough.url}
            autoPlay muted loop playsInline controls
            className="w-full h-auto max-h-[560px] object-cover"
            poster={model}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-20 w-20 rounded-full bg-amber/95 text-accent-foreground flex items-center justify-center shadow-amber ring-8 ring-background/30 animate-pulse">
              <Play className="h-8 w-8 fill-current ml-1" />
            </div>
          </div>
        </div>
      </section>

      {/* TRENDING PRODUCTS */}
      <section className="mx-auto max-w-6xl px-4 mt-20">
        <div className="flex items-end justify-between mb-6">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-amber inline-flex items-center gap-2"><Flame className="h-3.5 w-3.5" /> Trending now</span>
            <h2 className="font-display text-4xl md:text-5xl mt-2">Fresh thrift drops</h2>
          </div>
          <Link to="/browse" className="text-sm text-amber inline-flex items-center gap-1 hover:gap-2 transition-all">See all <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {products && products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {products.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-3xl p-12 text-center">
            <Sparkles className="h-8 w-8 text-amber mx-auto" />
            <p className="mt-3 text-muted-foreground">No drops yet — be the first to list something fresh.</p>
            <Link to="/sell" className="mt-5 inline-flex h-12 px-7 items-center rounded-full bg-amber text-accent-foreground font-bold shadow-amber">List an item</Link>
          </div>
        )}
      </section>

      {/* TRUST PILLARS */}
      <section className="mx-auto max-w-6xl px-4 mt-24">
        <div className="divider-amber mb-10" />
        <h2 className="font-display text-4xl md:text-5xl text-center">Built for Naija buyers &amp; sellers</h2>
        <p className="mt-3 text-center text-base text-muted-foreground max-w-xl mx-auto">Secure transactions, lightning-fast listings, nationwide delivery.</p>
        <div className="mt-10 grid sm:grid-cols-3 gap-4">
          {[
            { Icon: ShieldCheck, t: "Escrow Protected", d: "We hold payment until you confirm delivery. Zero risk, zero scams." },
            { Icon: Wallet, t: "List in 60 Seconds", d: "Snap, price, publish. Reach thousands of Naija buyers instantly." },
            { Icon: Truck, t: "Nationwide Delivery", d: "Trusted riders to all 36 states with transparent pricing." },
          ].map(({ Icon, t, d }) => (
            <div key={t} className="bg-card border border-border rounded-3xl p-6 hover:border-amber transition-colors">
              <div className="h-12 w-12 rounded-2xl bg-amber/10 border border-amber/30 flex items-center justify-center">
                <Icon className="h-6 w-6 text-amber" />
              </div>
              <h3 className="mt-4 font-display text-2xl">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="mx-auto max-w-6xl px-4 mt-24">
        <div className="text-center mb-10">
          <span className="text-xs uppercase tracking-[0.3em] text-amber">Loved by thousands</span>
          <h2 className="font-display text-4xl md:text-5xl mt-2">Real stories. Real wins.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-card border border-border rounded-3xl p-6 relative hover:-translate-y-1 transition-transform">
              <Quote className="h-7 w-7 text-amber/40 absolute top-5 right-5" />
              <div className="flex gap-0.5">
                {Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="h-4 w-4 fill-amber text-amber" />)}
              </div>
              <p className="mt-4 text-sm leading-relaxed">"{t.body}"</p>
              <div className="mt-5 pt-4 border-t border-border">
                <div className="font-semibold text-sm">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-5xl px-4 mt-24">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground p-10 md:p-16 text-center">
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-amber/30 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-amber/20 blur-3xl" />
          <div className="relative">
            <h2 className="font-display text-4xl md:text-6xl">Ready to join BTHRIFTS?</h2>
            <p className="mt-4 text-primary-foreground/90 max-w-md mx-auto text-base">
              Whether you're hunting steals or turning your closet into cash — start in seconds.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/browse" className="inline-flex items-center gap-2 px-8 h-13 py-3.5 rounded-full bg-background text-foreground font-semibold hover:scale-[1.02] transition-transform">
                <ShoppingBag className="h-5 w-5" /> Start Buying
              </Link>
              <Link to="/sell" className="inline-flex items-center gap-2 px-8 h-13 py-3.5 rounded-full bg-amber text-accent-foreground font-bold shadow-amber hover:scale-[1.02] transition-transform">
                <Store className="h-5 w-5" /> Start Selling <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
      <MobileNav />
    </div>
  );
}

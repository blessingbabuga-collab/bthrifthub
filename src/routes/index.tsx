import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShoppingBag, Store, Truck, Wallet, ArrowRight, Play } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { ProductCard } from "@/components/ProductCard";
import { fetchProducts } from "@/lib/products";
import model from "@/assets/model-1.jpg";
import walkthrough from "../../public/bthrifts-walkthrough.mp4.asset.json";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { data: products } = useQuery({ queryKey: ["products", "trending"], queryFn: () => fetchProducts({ limit: 8 }) });
  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />

      {/* HERO */}
      <section className="relative bg-hero overflow-hidden">
        <div className="mx-auto max-w-3xl px-4 pt-12 pb-14 md:pt-20 md:pb-20 text-center">
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-amber">
            <span className="h-px w-8 bg-amber" /> BTHRIFTS Marketplace <span className="h-px w-8 bg-amber" />
          </span>
          <h1 className="font-display text-4xl md:text-6xl leading-[1.02] mt-5">
            Nigeria's Smart <span className="text-primary">Thrift</span> Marketplace<br className="hidden md:block" />
            for <span className="text-amber">Buying &amp; Selling</span>
          </h1>
          <p className="mt-5 text-muted-foreground max-w-xl mx-auto">
            Discover affordable thrift fashion from trusted sellers, or turn your closet into income — all in one secure, Naija-built marketplace.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/browse" className="inline-flex items-center gap-2 px-7 h-13 py-3 rounded-full bg-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95">
              <ShoppingBag className="h-4 w-4" /> Buy
            </Link>
            <Link to="/sell" className="inline-flex items-center gap-2 px-7 h-13 py-3 rounded-full bg-amber text-accent-foreground font-bold shadow-amber hover:opacity-95">
              <Store className="h-4 w-4" /> Sell
            </Link>
          </div>
        </div>
      </section>

      {/* DEMO VIDEO */}
      <section className="mx-auto max-w-4xl px-4 mt-4 md:mt-8">
        <div className="text-center mb-6">
          <h2 className="font-display text-3xl md:text-4xl">How BTHRIFTS Works</h2>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">Watch how to buy and sell on BTHRIFTS in minutes</p>
        </div>
        <div className="relative rounded-3xl overflow-hidden border border-border bg-card shadow-glow">
          <video
            src={walkthrough.url}
            autoPlay muted loop playsInline
            controls
            className="w-full h-auto max-h-[560px] object-cover"
            poster={model}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-90">
            <div className="h-16 w-16 rounded-full bg-amber/95 text-accent-foreground flex items-center justify-center shadow-amber ring-4 ring-background/40 animate-pulse">
              <Play className="h-7 w-7 fill-current" />
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section className="mx-auto max-w-6xl px-4 mt-14">
        <div className="flex items-end justify-between mb-5">
          <div>
            <span className="text-xs uppercase tracking-widest text-amber">For buyers</span>
            <h2 className="font-display text-3xl md:text-4xl">Latest listings</h2>
          </div>
          <Link to="/browse" className="text-sm text-amber">See all →</Link>
        </div>
        {products && products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {products.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-3xl p-10 text-center">
            <p className="text-muted-foreground">No drops yet — be the first to list something fresh.</p>
            <Link to="/sell" className="mt-4 inline-flex h-11 px-6 items-center rounded-full bg-amber text-accent-foreground font-bold">List an item</Link>
          </div>
        )}
      </section>

      {/* WHY */}
      <section className="mx-auto max-w-6xl px-4 mt-20">
        <div className="divider-amber mb-10" />
        <h2 className="font-display text-3xl md:text-4xl text-center">A marketplace you can trust</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">Secure transactions, fast selling, nationwide delivery.</p>
        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {[
            { Icon: ShieldCheck, t: "Secure Marketplace", d: "Escrow holds payment until you confirm delivery — buy and sell with peace of mind." },
            { Icon: Wallet, t: "Easy Listing, Fast Selling", d: "Publish a product in under a minute and reach buyers across Nigeria instantly." },
            { Icon: Truck, t: "Nationwide Delivery", d: "Trusted riders deliver to all 36 states with transparent pricing." },
          ].map(({ Icon, t, d }) => (
            <div key={t} className="bg-card border border-border rounded-2xl p-5">
              <Icon className="h-6 w-6 text-amber" />
              <h3 className="mt-3 font-display text-xl">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-5xl px-4 mt-20">
        <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-8 md:p-14 text-center">
          <h2 className="font-display text-3xl md:text-5xl">Ready to join BTHRIFTS?</h2>
          <p className="mt-3 text-primary-foreground/80 max-w-md mx-auto">
            Whether you're hunting for a steal or turning your closet into cash — start in seconds.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/browse" className="inline-flex items-center gap-2 px-7 h-12 rounded-full bg-background text-foreground font-semibold hover:opacity-95">
              <ShoppingBag className="h-4 w-4" /> Start Buying
            </Link>
            <Link to="/sell" className="inline-flex items-center gap-2 px-7 h-12 rounded-full bg-amber text-accent-foreground font-bold shadow-amber hover:opacity-95">
              <Store className="h-4 w-4" /> Start Selling <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
      <MobileNav />
    </div>
  );
}

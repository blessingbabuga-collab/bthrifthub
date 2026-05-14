import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Sparkles, Truck, Wallet, ArrowRight, Play } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { ProductCard } from "@/components/ProductCard";
import { products, categories } from "@/data/products";
import flatlay from "@/assets/thrift-flatlay.jpg";
import model from "@/assets/model-1.jpg";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />

      {/* HERO */}
      <section className="relative bg-hero overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pt-10 pb-14 md:pt-20 md:pb-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-amber">
              <span className="h-px w-8 bg-amber" /> Thrift & Style
            </span>
            <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mt-4">
              Nigeria's <span className="text-primary">thrift</span> marketplace,<br/>
              built for the <span className="text-amber">streets.</span>
            </h1>
            <p className="mt-5 text-muted-foreground max-w-md">
              Discover affordable thrift fashion, shoes and bags from trusted sellers across Naija. Pay in Naira, secured by escrow.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/browse" className="inline-flex items-center gap-2 px-6 h-12 rounded-full bg-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95">
                Start shopping <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/sell" className="inline-flex items-center gap-2 px-6 h-12 rounded-full border border-amber text-amber font-semibold hover:bg-amber hover:text-accent-foreground transition-colors">
                Sell on Bthrifs
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
              <div><span className="block font-display text-2xl text-foreground">12k+</span>Active sellers</div>
              <div><span className="block font-display text-2xl text-foreground">90k+</span>Items listed</div>
              <div><span className="block font-display text-2xl text-foreground">4.9★</span>Buyer rating</div>
            </div>
          </div>
          <div className="relative">
            <div className="relative rounded-3xl overflow-hidden shadow-glow ring-brand">
              <img src={model} alt="Bthrifs style" width={1024} height={1280} className="w-full aspect-[4/5] object-cover" />
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-background to-transparent">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full bg-amber text-accent-foreground font-bold">DROP</span>
                  <span>New Lagos thrift haul · 240 items</span>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-6 hidden md:block bg-card border border-border rounded-2xl p-3 w-44 shadow-amber">
              <img src={flatlay} alt="" loading="lazy" width={1280} height={1600} className="rounded-xl aspect-square object-cover" />
              <p className="mt-2 text-[11px] text-muted-foreground">Curated for you</p>
            </div>
          </div>
        </div>
      </section>

      {/* DEMO VIDEO */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="relative rounded-3xl overflow-hidden border border-border bg-card">
          <video
            src="/bthrifs-demo.mp4"
            autoPlay muted loop playsInline
            className="w-full h-auto max-h-[520px] object-cover"
            poster={model}
          />
          <div className="absolute top-4 left-4 inline-flex items-center gap-2 text-xs bg-background/70 backdrop-blur px-3 py-1.5 rounded-full">
            <Play className="h-3 w-3 text-amber fill-amber" /> See Bthrifs in motion
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-6xl px-4 mt-14">
        <div className="flex items-end justify-between mb-5">
          <h2 className="font-display text-3xl md:text-4xl">Shop by category</h2>
          <Link to="/browse" className="text-sm text-amber">See all →</Link>
        </div>
        <div className="flex sm:grid sm:grid-cols-6 gap-3 overflow-x-auto no-scrollbar scroll-x -mx-4 px-4">
          {categories.map((c) => (
            <button key={c.name} className="shrink-0 w-28 sm:w-auto bg-card border border-border rounded-2xl py-5 flex flex-col items-center gap-2 hover:border-amber transition-colors">
              <span className="text-3xl">{c.emoji}</span>
              <span className="text-sm font-medium">{c.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* PRODUCTS */}
      <section className="mx-auto max-w-6xl px-4 mt-14">
        <div className="flex items-end justify-between mb-5">
          <div>
            <span className="text-xs uppercase tracking-widest text-amber">Trending now</span>
            <h2 className="font-display text-3xl md:text-4xl">Fresh thrift drops</h2>
          </div>
          <Link to="/browse" className="text-sm text-amber">Browse all →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* WHY */}
      <section className="mx-auto max-w-6xl px-4 mt-20">
        <div className="divider-amber mb-10" />
        <h2 className="font-display text-3xl md:text-4xl text-center">Why thousands buy on Bthrifs</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { Icon: ShieldCheck, t: "Escrow Protected", d: "Sellers only get paid after you confirm delivery." },
            { Icon: Wallet, t: "Pay in Naira", d: "Paystack, Flutterwave, transfer or wallet — your choice." },
            { Icon: Truck, t: "Nationwide Delivery", d: "Trusted riders deliver across all 36 states." },
            { Icon: Sparkles, t: "AI Discovery", d: "Smart recommendations tuned to your style." },
          ].map(({ Icon, t, d }) => (
            <div key={t} className="bg-card border border-border rounded-2xl p-5">
              <Icon className="h-6 w-6 text-amber" />
              <h3 className="mt-3 font-display text-xl">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SELLER CTA */}
      <section className="mx-auto max-w-6xl px-4 mt-20">
        <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-8 md:p-14 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <span className="text-xs uppercase tracking-widest text-amber">For sellers</span>
            <h2 className="font-display text-4xl md:text-5xl mt-2">Turn your thrift into income.</h2>
            <p className="mt-3 text-primary-foreground/80 max-w-md">
              List in 60 seconds. Reach buyers nationwide. Get paid fast — straight to your bank.
            </p>
            <Link to="/sell" className="mt-6 inline-flex items-center gap-2 px-6 h-12 rounded-full bg-amber text-accent-foreground font-bold shadow-amber">
              Become a seller <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <img src={flatlay} alt="" loading="lazy" width={1280} height={1600} className="rounded-2xl w-full aspect-[4/3] object-cover" />
        </div>
      </section>

      <SiteFooter />
      <MobileNav />
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { Camera, BadgeCheck, Banknote, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/sell")({
  component: Sell,
  head: () => ({ meta: [{ title: "Sell on Bthrifs — Turn Thrift into Income" }] }),
});

function Sell() {
  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />
      <section className="bg-hero">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <span className="text-xs uppercase tracking-[0.25em] text-amber">Become a seller</span>
          <h1 className="font-display text-5xl md:text-7xl mt-3 max-w-3xl leading-[0.95]">
            Your thrift hustle, <span className="text-primary">amplified.</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-xl">
            Set up a verified Bthrifs store in minutes. Reach buyers across all 36 states. Get paid securely after every order.
          </p>
          <Link to="/login" className="mt-7 inline-flex items-center gap-2 px-6 h-12 rounded-full bg-amber text-accent-foreground font-bold shadow-amber">
            Open my store <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 grid md:grid-cols-3 gap-4">
        {[
          { Icon: Camera, t: "01 · Snap & list", d: "Upload photos, set your price in Naira, publish in under a minute." },
          { Icon: BadgeCheck, t: "02 · Get verified", d: "Earn the verified badge to build trust and rank higher." },
          { Icon: Banknote, t: "03 · Get paid", d: "Funds release to your bank as soon as the buyer confirms." },
        ].map(({ Icon, t, d }) => (
          <div key={t} className="bg-card border border-border rounded-2xl p-6">
            <Icon className="h-6 w-6 text-amber" />
            <h3 className="font-display text-2xl mt-3">{t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}

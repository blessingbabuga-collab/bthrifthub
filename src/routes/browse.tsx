import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { ProductCard } from "@/components/ProductCard";
import { products, categories } from "@/data/products";
import { SlidersHorizontal } from "lucide-react";

export const Route = createFileRoute("/browse")({
  component: Browse,
  head: () => ({ meta: [{ title: "Browse Thrift — Bthrifs Marketplace" }] }),
});

function Browse() {
  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="font-display text-4xl md:text-5xl">Browse Thrift</h1>
        <p className="text-sm text-muted-foreground mt-1">Curated finds from sellers across Nigeria.</p>

        <div className="mt-6 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          <button className="shrink-0 inline-flex items-center gap-2 px-4 h-10 rounded-full border border-amber text-amber text-sm">
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </button>
          {["All", ...categories.map((c) => c.name)].map((c, i) => (
            <button key={c} className={`shrink-0 px-4 h-10 rounded-full text-sm border ${i === 0 ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-amber"}`}>
              {c}
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {[...products, ...products].map((p, i) => <ProductCard key={p.id + i} p={p} />)}
        </div>
      </div>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}

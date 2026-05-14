import { Heart, MapPin, Star } from "lucide-react";
import { formatNaira, type Product } from "@/data/products";

export function ProductCard({ p }: { p: Product }) {
  const discount = p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
  return (
    <article className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-transform">
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        <img src={p.image} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-1 rounded-full">
            -{discount}%
          </span>
        )}
        <button aria-label="Save" className="absolute top-2 right-2 p-2 rounded-full bg-background/70 backdrop-blur hover:bg-background">
          <Heart className="h-4 w-4" />
        </button>
        <span className="absolute bottom-2 left-2 text-[10px] uppercase tracking-wider bg-background/80 backdrop-blur px-2 py-0.5 rounded-full border border-border">
          {p.condition}
        </span>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium line-clamp-1">{p.title}</h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-base font-bold text-amber">{formatNaira(p.price)}</span>
          {p.originalPrice && (
            <span className="text-xs text-muted-foreground line-through">{formatNaira(p.originalPrice)}</span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{p.location}</span>
          <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-amber text-amber" />{p.rating}</span>
        </div>
      </div>
    </article>
  );
}

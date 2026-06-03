import { Heart, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatNaira } from "@/lib/products";

export type CardProduct = {
  id: string;
  title: string;
  price: number;
  original_price?: number | null;
  image_url: string;
  condition: string;
  location?: string | null;
};

export function ProductCard({ p }: { p: CardProduct }) {
  const discount = p.original_price ? Math.round((1 - p.price / Number(p.original_price)) * 100) : 0;
  return (
    <Link to="/product/$id" params={{ id: p.id }} className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-transform block">
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        <img src={p.image_url} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-1 rounded-full">
            -{discount}%
          </span>
        )}
        <span aria-hidden className="absolute top-2 right-2 p-2 rounded-full bg-background/70 backdrop-blur">
          <Heart className="h-4 w-4" />
        </span>
        <span className="absolute bottom-2 left-2 text-[10px] uppercase tracking-wider bg-background/80 backdrop-blur px-2 py-0.5 rounded-full border border-border">
          {p.condition}
        </span>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium line-clamp-1">{p.title}</h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-base font-bold text-amber">{formatNaira(Number(p.price))}</span>
          {p.original_price && (
            <span className="text-xs text-muted-foreground line-through">{formatNaira(Number(p.original_price))}</span>
          )}
        </div>
        {p.location && (
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{p.location}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

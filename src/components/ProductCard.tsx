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

export function ProductCard({ p, isOwner }: { p: CardProduct, isOwner?: boolean }) {
  const discount = p.original_price ? Math.round((1 - p.price / Number(p.original_price)) * 100) : 0;
  return (
    <Link to="/product/$id" params={{ id: p.id }} className="group block relative bg-card border border-border shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 ease-out rounded-2xl overflow-hidden">
      <div className="relative aspect-square overflow-hidden bg-secondary/50">
        <img src={p.image_url} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out" />
        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
            -{discount}%
          </span>
        )}
        {(p as any).shadow_banned && (
          <span className="absolute top-2 right-2 bg-red-500/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm z-10">
            SHADOW BANNED
          </span>
        )}
        {!isOwner && (
          <div role="button" aria-label="Favorite" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="absolute bottom-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border text-muted-foreground hover:text-foreground hover:bg-background transition-all">
            <Heart className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-lg font-bold text-foreground tracking-tight">{formatNaira(Number(p.price))}</span>
          <span className="text-[9px] font-medium uppercase tracking-wider bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
            {p.condition}
          </span>
        </div>
        <h3 className="text-xs font-medium text-muted-foreground line-clamp-1">{p.title}</h3>
        {p.original_price && (
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[10px] text-muted-foreground/60 line-through">{formatNaira(Number(p.original_price))}</span>
          </div>
        )}
        {p.location && !isOwner && (
          <div className="mt-2 pt-2 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 opacity-50" />{p.location}</span>
          </div>
        )}
        {isOwner && (
          <div className="mt-2 pt-2 flex items-center justify-between border-t border-border/50">
            <Link
              to="/edit/$id"
              params={{ id: p.id }}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-center text-[10px] uppercase font-bold tracking-widest text-primary hover:text-primary/80 transition-colors py-1"
            >
              Edit Listing
            </Link>
          </div>
        )}
      </div>
    </Link>
  );
}

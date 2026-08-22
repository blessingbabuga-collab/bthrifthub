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
    <Link to="/product/$id" params={{ id: p.id }} className="group relative bg-[#15151a] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] hover:shadow-[0_12px_40px_-10px_rgba(85,43,213,0.3)] hover:-translate-y-1.5 transition-all duration-300 ease-out rounded-[24px] overflow-hidden block">
      <div className="relative aspect-[4/5] overflow-hidden bg-[#0d0d10]">
        <img src={p.image_url} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out" />
        {discount > 0 && (
          <span className="absolute top-3 left-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg">
            -{discount}%
          </span>
        )}
        <button aria-label="Favorite" className="absolute top-3 right-3 p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/20 active:scale-95 transition-all">
          <Heart className="h-4 w-4 text-white/90" />
        </button>
        <span className="absolute bottom-3 left-3 text-[10px] uppercase tracking-wider bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white/90 font-medium">
          {p.condition}
        </span>
      </div>
      <div className="p-4 pt-5">
        <h3 className="text-sm font-medium tracking-tight text-white/95 line-clamp-1 group-hover:text-amber-400 transition-colors">{p.title}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold text-amber-500 tracking-tight">{formatNaira(Number(p.price))}</span>
          {p.original_price && (
            <span className="text-xs text-white/40 line-through font-medium">{formatNaira(Number(p.original_price))}</span>
          )}
        </div>
        {p.location && (
          <div className="mt-3 pt-3 flex items-center justify-between text-[11px] text-white/50 border-t border-white/5">
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-white/30" />{p.location}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

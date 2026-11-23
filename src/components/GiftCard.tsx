import { Link } from "@tanstack/react-router";
import { Gift, MapPin, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import type { GiftListing } from "@/lib/giving";

interface GiftCardProps {
  gift: GiftListing & {
    giver?: {
      id: string;
      username: string | null;
      full_name: string | null;
      avatar_url: string | null;
      is_verified?: boolean;
    };
  };
}

export function GiftCard({ gift }: GiftCardProps) {
  const coverImage = gift.images && gift.images.length > 0
    ? gift.images[0]
    : "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=600&auto=format&fit=crop&q=80";

  const getStatusBadge = () => {
    switch (gift.status) {
      case "awarded":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Awarded
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            Completed
          </span>
        );
      case "applications_closed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            Applications Closed
          </span>
        );
      case "withdrawn":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
            Withdrawn
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-600 text-white shadow-sm">
            <Sparkles className="w-3 h-3" /> 100% Free Gift
          </span>
        );
    }
  };

  const isClosed = gift.status !== "published" || (gift.deadline && new Date(gift.deadline) < new Date());

  return (
    <Link
      to="/giving/$id"
      params={{ id: gift.id }}
      className="group flex flex-col bg-card rounded-2xl overflow-hidden border border-border/80 hover:border-amber/60 hover:shadow-lg transition-all duration-300"
    >
      {/* IMAGE CONTAINER */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
        <img
          src={coverImage}
          alt={gift.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        
        {/* TOP STATUS BADGES */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
          {getStatusBadge()}
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-black/60 text-white backdrop-blur-md">
            {gift.category}
          </span>
        </div>

        {/* CHRISTMAS RIBBON ACCENT */}
        <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-600 via-amber-500 to-rose-600" />
      </div>

      {/* CONTENT */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
          <span className="font-medium text-foreground">{gift.condition}</span>
          {gift.brand && (
            <>
              <span>•</span>
              <span className="truncate">{gift.brand}</span>
            </>
          )}
          {gift.size && (
            <>
              <span>•</span>
              <span>{gift.size}</span>
            </>
          )}
        </div>

        <h3 className="font-semibold text-base text-foreground line-clamp-1 group-hover:text-amber transition-colors">
          {gift.title}
        </h3>

        {gift.intended_beneficiary_description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 bg-secondary/40 p-2 rounded-lg italic">
            "{gift.intended_beneficiary_description}"
          </p>
        )}

        <div className="mt-auto pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1 truncate max-w-[150px]">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{gift.location}</span>
          </div>

          {gift.deadline && !isClosed && (
            <div className="flex items-center gap-1 text-[11px] text-amber-700 font-medium">
              <Clock className="w-3 h-3" />
              <span>Closes {new Date(gift.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

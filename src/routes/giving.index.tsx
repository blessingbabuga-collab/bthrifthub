import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Gift,
  Heart,
  Sparkles,
  Users,
  ShieldCheck,
  ArrowRight,
  PlusCircle,
  Search,
  CheckCircle2,
  TreePine,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { GivingNav } from "@/components/GivingNav";
import { GiftCard } from "@/components/GiftCard";
import { fetchPublishedGifts, fetchFindGiftEnabled } from "@/lib/giving";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/giving/")({
  component: GivingIndexPage,
  head: () => ({
    meta: [
      { title: "Christmas Giving — BTHRIFTS" },
      {
        name: "description",
        content: "Give a little. Make someone's Christmas. A community spirit initiative on BTHRIFTS.",
      },
    ],
  }),
});

function GivingIndexPage() {
  const { user } = useAuth();
  const { data: findGiftEnabled = false } = useQuery({
    queryKey: ["giving_find_gift_enabled"],
    queryFn: fetchFindGiftEnabled,
  });
  const { data: recentGifts = [], isLoading } = useQuery({
    queryKey: ["published_gifts", "recent"],
    enabled: findGiftEnabled,
    queryFn: () => fetchPublishedGifts({ limit: 6, status: "published" }),
  });

  return (
    <div className="min-h-screen pb-24 sm:pb-0 bg-background">
      <SiteHeader />
      <GivingNav currentPath="/giving" hasActiveUser={!!user} />

      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-950 via-emerald-900 to-slate-900 text-white py-14 sm:py-20 px-4">
        {/* Festive background accents */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <TreePine className="absolute -left-6 bottom-0 w-48 h-48 sm:w-72 sm:h-72 text-emerald-400/15 -rotate-6" />
          <TreePine className="absolute -right-8 -bottom-4 w-56 h-56 sm:w-80 sm:h-80 text-amber-400/10 rotate-6" />
          <TreePine className="hidden md:block absolute left-1/4 top-4 w-24 h-24 text-emerald-300/10" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-800/80 border border-emerald-600/50 text-emerald-200 text-xs sm:text-sm font-medium tracking-wide">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Christmas Giving Initiative</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-bold tracking-tight text-white leading-tight">
            Give a little. <br className="hidden sm:inline" />
            Make someone's Christmas.
          </h1>

          <p className="text-sm sm:text-lg text-emerald-100/90 max-w-2xl mx-auto leading-relaxed">
            Every item you no longer use can be a meaningful Christmas present for someone in our community. Share warmth, kindness, and joy this holiday season.
          </p>

          {/* TWO PRIMARY ACTIONS */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
            <Link
              to={user ? "/giving/create" : "/auth"}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base shadow-lg transition-transform active:scale-95"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Give a Gift</span>
            </Link>

            {findGiftEnabled && (
              <Link
                to="/giving/browse"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-display font-bold text-base border border-white/20 backdrop-blur-md transition-colors"
              >
                <Search className="w-5 h-5 text-amber-300" />
                <span>Find a Gift</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
            How Christmas Giving Works
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Free, dignified, and community-centered gift sharing.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-card border border-border/80 rounded-2xl p-6 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
              <Gift className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">1. Publish a Gift</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              List clean clothing, footwear, toys, or gadgets you'd love to gift. All gifts are 100% free — zero prices and zero fees.
            </p>
          </div>

          <div className="bg-card border border-border/80 rounded-2xl p-6 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Heart className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">2. Apply With Care</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Apply for yourself or nominate someone who would benefit. Share a short message explaining why the gift would help.
            </p>
          </div>

          <div className="bg-card border border-border/80 rounded-2xl p-6 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">3. Intentional Selection</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Givers review applications thoughtfully, choose one recipient, and arrange a safe collection or handover.
            </p>
          </div>
        </div>
      </section>

      {/* RECENTLY PUBLISHED GIFTS */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        {!findGiftEnabled ? (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-8 sm:p-10 text-center space-y-3">
            <Sparkles className="w-10 h-10 text-emerald-700 mx-auto" />
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
              We Are Currently Collecting Gifts! 🎁
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
              Generous community members are currently donating items for Christmas. Public browsing and gift applications will open soon!
            </p>
            <div className="pt-2">
              <Link
                to={user ? "/giving/create" : "/auth"}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors"
              >
                <PlusCircle className="w-4 h-4" /> Donate a Gift Now
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Available Christmas Gifts
            </h2>
            <p className="text-xs text-muted-foreground">Discover heartwarming items ready to bring joy.</p>
          </div>

          <Link
            to="/giving/browse"
            className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-[4/3] rounded-2xl bg-secondary animate-pulse" />
            ))}
          </div>
        ) : recentGifts.length === 0 ? (
          <div className="bg-secondary/40 border border-border/80 rounded-2xl p-10 text-center space-y-4">
            <Gift className="w-12 h-12 text-muted-foreground mx-auto" />
            <h3 className="font-semibold text-base text-foreground">Be the first to give this Christmas</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No gifts have been published in your area yet. Share an item from your wardrobe or home today!
            </p>
            <Link
              to={user ? "/giving/create" : "/auth"}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors"
            >
              <PlusCircle className="w-4 h-4" /> Give a Gift Now
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {recentGifts.map((gift: any) => (
              <GiftCard key={gift.id} gift={gift} />
            ))}
          </div>
        )}
          </>
        )}
      </section>

      {/* COMMUNITY SAFETY CALLOUT */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-gradient-to-r from-emerald-50 to-amber-50 border border-emerald-200/60 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="space-y-1 text-center sm:text-left flex-1">
            <h4 className="font-semibold text-base text-slate-900">Protected Handover & Privacy First</h4>
            <p className="text-xs text-slate-700 leading-relaxed">
              Meeting locations and contact details are only revealed between the giver and the single selected recipient. All Christmas gifts are strictly free.
            </p>
          </div>
          <Link
            to="/giving/browse"
            className="shrink-0 px-4 py-2 rounded-full border border-emerald-800 text-emerald-800 font-semibold text-xs hover:bg-emerald-800 hover:text-white transition-colors"
          >
            Explore Gifts
          </Link>
        </div>
      </section>

      <div className="hidden sm:block">
        <SiteFooter />
      </div>
      <MobileNav />
    </div>
  );
}

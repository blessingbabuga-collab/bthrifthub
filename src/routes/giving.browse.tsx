import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, Gift, Sparkles, X, PlusCircle } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { GivingNav } from "@/components/GivingNav";
import { GiftCard } from "@/components/GiftCard";
import { fetchPublishedGifts, fetchFindGiftEnabled, GIFT_CATEGORIES, GIFT_CONDITIONS } from "@/lib/giving";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/giving/browse")({
  component: GivingBrowsePage,
  head: () => ({
    meta: [
      { title: "Browse Christmas Gifts — BTHRIFTS" },
      { name: "description", content: "Explore available Christmas gifts in your community. Find clothes, shoes, toys and more." },
    ],
  }),
});

function GivingBrowsePage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedCondition, setSelectedCondition] = useState("All");
  const [cityFilter, setCityFilter] = useState("");

  const { data: findGiftEnabled = false, isLoading: settingLoading } = useQuery({
    queryKey: ["giving_find_gift_enabled"],
    queryFn: fetchFindGiftEnabled,
  });

  const { data: gifts = [], isLoading } = useQuery({
    queryKey: ["published_gifts", selectedCategory, selectedCondition, cityFilter, searchTerm],
    enabled: findGiftEnabled,
    queryFn: () =>
      fetchPublishedGifts({
        category: selectedCategory,
        condition: selectedCondition,
        city: cityFilter || undefined,
        search: searchTerm || undefined,
      }),
  });

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("All");
    setSelectedCondition("All");
    setCityFilter("");
  };

  const hasActiveFilters =
    searchTerm !== "" || selectedCategory !== "All" || selectedCondition !== "All" || cityFilter !== "";

  return (
    <div className="min-h-screen pb-24 sm:pb-0 bg-background">
      <SiteHeader />
      <GivingNav currentPath="/giving/browse" hasActiveUser={!!user} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Christmas Giving Feed</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-display font-bold text-foreground">
              Find a Gift
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Browse items freely offered by fellow members of the community this Christmas.
            </p>
          </div>

          <Link
            to={user ? "/giving/create" : "/auth"}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs sm:text-sm shadow-sm transition-transform active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Give a Gift</span>
          </Link>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 mb-8 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* SEARCH INPUT */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search gifts, titles, brands..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 h-11 rounded-xl bg-secondary/50 border border-border/80 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* CITY / LOCATION FILTER */}
            <div className="sm:w-60">
              <input
                type="text"
                placeholder="Location (e.g. Lagos, Abuja)..."
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="w-full px-4 h-11 rounded-xl bg-secondary/50 border border-border/80 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors"
              />
            </div>
          </div>

          {/* CATEGORIES PILLS */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setSelectedCategory("All")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === "All"
                  ? "bg-foreground text-background font-semibold"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              All Categories
            </button>
            {GIFT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? "bg-foreground text-background font-semibold"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* ACTIVE FILTER RESET */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs text-muted-foreground">
              <span>Showing filtered gifts</span>
              <button
                onClick={clearFilters}
                className="text-emerald-700 hover:underline font-medium flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear filters
              </button>
            </div>
          )}
        </div>

        {/* RESULTS GRID */}
        {settingLoading || isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[4/3] rounded-2xl bg-secondary animate-pulse" />
            ))}
          </div>
        ) : !findGiftEnabled ? (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-12 text-center space-y-3">
            <Sparkles className="w-12 h-12 text-emerald-700 mx-auto" />
            <h3 className="font-display font-bold text-xl text-slate-900">Find a Gift is Opening Soon! 🎁</h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              We are currently collecting gifts from generous community members. Public browsing and gift applications will open shortly!
            </p>
            <Link
              to={user ? "/giving/create" : "/auth"}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors"
            >
              <PlusCircle className="w-4 h-4" /> Give a Gift Now
            </Link>
          </div>
        ) : gifts.length === 0 ? (
          <div className="bg-secondary/30 border border-border/80 rounded-2xl p-12 text-center space-y-3">
            <Gift className="w-12 h-12 text-muted-foreground/60 mx-auto" />
            <h3 className="font-semibold text-base text-foreground">No gifts matched your search</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Try adjusting your search terms or clearing your category filters to see more results.
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 px-4 py-2 rounded-full border border-border text-xs font-medium hover:bg-secondary"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {gifts.map((gift: any) => (
              <GiftCard key={gift.id} gift={gift} />
            ))}
          </div>
        )}
      </main>

      <div className="hidden sm:block">
        <SiteFooter />
      </div>
      <MobileNav />
    </div>
  );
}

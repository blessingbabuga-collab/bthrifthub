import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ListOrdered,
  PlusCircle,
  Gift,
  CheckCircle2,
  Users,
  Clock,
  Sparkles,
  ArrowRight,
  MoreVertical,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { GivingNav } from "@/components/GivingNav";
import { fetchMyGifts } from "@/lib/giving";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/giving/my-gifts/")({
  component: MyGiftsPage,
  head: () => ({
    meta: [{ title: "My Given Gifts — Christmas Giving — BTHRIFTS" }],
  }),
});

function MyGiftsPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: gifts = [], isLoading } = useQuery({
    queryKey: ["my_given_gifts", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchMyGifts(user!.id),
  });

  const handleWithdrawGift = async (giftId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("gift_listings")
        .update({ status: "withdrawn", updated_at: new Date().toISOString() })
        .eq("id", giftId)
        .eq("giver_id", user!.id);

      if (error) throw error;
      toast.success("Gift withdrawn.");
      queryClient.invalidateQueries({ queryKey: ["my_given_gifts", user?.id] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to withdraw gift");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <Sparkles className="w-3 h-3" /> Published
          </span>
        );
      case "awarded":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            Recipient Selected
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case "draft":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary text-muted-foreground">
            Draft
          </span>
        );
      case "withdrawn":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground line-through">
            Withdrawn
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary text-foreground">
            {status}
          </span>
        );
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <GivingNav currentPath="/giving/my-gifts" hasActiveUser={false} />
        <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
          <Gift className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold">Please log in</h1>
          <p className="text-xs text-muted-foreground">Log in to view the gifts you are sharing.</p>
          <Link
            to="/auth"
            className="inline-flex px-5 py-2.5 rounded-full bg-emerald-700 text-white text-xs font-semibold"
          >
            Log In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 sm:pb-0 bg-background">
      <SiteHeader />
      <GivingNav currentPath="/giving/my-gifts" hasActiveUser={true} />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">
              <Gift className="w-4 h-4" />
              <span>Giver Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
              My Given Gifts
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage your published gifts, review incoming applications, and track handovers.
            </p>
          </div>

          <Link
            to="/giving/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs sm:text-sm shadow-sm transition-transform active:scale-95 self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Give Another Gift</span>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-secondary animate-pulse" />
            ))}
          </div>
        ) : gifts.length === 0 ? (
          <div className="bg-secondary/40 border border-border/80 rounded-2xl p-12 text-center space-y-3">
            <Gift className="w-12 h-12 text-muted-foreground/60 mx-auto" />
            <h3 className="font-semibold text-base text-foreground">You haven't listed any gifts yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Make someone's Christmas special by giving away an item from your wardrobe or home.
            </p>
            <Link
              to="/giving/create"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Publish Your First Gift</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {gifts.map((gift: any) => {
              const coverImg = gift.images?.[0] || "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=300&auto=format&fit=crop&q=80";
              const appsCount = gift.gift_applications?.length || 0;
              const canWithdraw = gift.status === "published" || gift.status === "applications_closed";

              return (
                <div
                  key={gift.id}
                  className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-xs transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <Link
                      to="/giving/$id"
                      params={{ id: gift.id }}
                      className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-secondary shrink-0 border border-border"
                    >
                      <img src={coverImg} alt="" className="w-full h-full object-cover" />
                    </Link>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(gift.status)}
                        <span className="text-[11px] text-muted-foreground">
                          {gift.category} • {gift.location}
                        </span>
                      </div>

                      <Link
                        to="/giving/$id"
                        params={{ id: gift.id }}
                        className="font-semibold text-sm sm:text-base text-foreground hover:text-emerald-700 transition-colors block truncate"
                      >
                        {gift.title}
                      </Link>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Users className="w-3.5 h-3.5 text-amber-600" />
                          {appsCount} {appsCount === 1 ? "application" : "applications"}
                        </span>
                        {gift.deadline && (
                          <span>
                            Closes {new Date(gift.deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0">
                    <Link
                      to="/giving/my-gifts/$id"
                      params={{ id: gift.id }}
                      className="px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Review Applications ({appsCount})</span>
                    </Link>

                    {(gift.status === "awarded" || gift.status === "completed") && (
                      <Link
                        to="/giving/handover/$id"
                        params={{ id: gift.id }}
                        className="px-3.5 py-2 rounded-full border border-emerald-700 text-emerald-800 font-semibold text-xs hover:bg-emerald-50 transition-colors"
                      >
                        Handover Tracker
                      </Link>
                    )}

                    {canWithdraw && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            Withdraw
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Withdraw this Gift?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to withdraw "{gift.title}"? Applications will be closed and applicants notified.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleWithdrawGift(gift.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Yes, Withdraw Gift
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            })}
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

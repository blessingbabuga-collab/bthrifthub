import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FolderHeart,
  Clock,
  Sparkles,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Trash2,
  HeartHandshake,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { GivingNav } from "@/components/GivingNav";
import { fetchMyGiftApplications } from "@/lib/giving";
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

export const Route = createFileRoute("/giving/my-applications")({
  component: MyApplicationsPage,
  head: () => ({
    meta: [{ title: "My Gift Applications — Christmas Giving — BTHRIFTS" }],
  }),
});

function MyApplicationsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["my_gift_applications", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchMyGiftApplications(user!.id),
  });

  const handleWithdraw = async (applicationId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("gift_applications")
        .update({ status: "withdrawn", updated_at: new Date().toISOString() })
        .eq("id", applicationId)
        .eq("applicant_id", user!.id);

      if (error) throw error;
      toast.success("Application withdrawn.");
      queryClient.invalidateQueries({ queryKey: ["my_gift_applications", user?.id] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to withdraw application");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "selected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> Selected! 🎁
          </span>
        );
      case "shortlisted":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Sparkles className="w-3.5 h-3.5" /> Shortlisted
          </span>
        );
      case "not_selected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
            <XCircle className="w-3.5 h-3.5" /> Not Selected
          </span>
        );
      case "withdrawn":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary text-muted-foreground line-through">
            Withdrawn
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <Clock className="w-3.5 h-3.5" /> Pending Review
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
        <GivingNav currentPath="/giving/my-applications" hasActiveUser={false} />
        <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
          <FolderHeart className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold">Please log in</h1>
          <p className="text-xs text-muted-foreground">
            Log in to view and track your Christmas Gift applications.
          </p>
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
      <GivingNav currentPath="/giving/my-applications" hasActiveUser={true} />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">
            <FolderHeart className="w-4 h-4" />
            <span>Applications Tracker</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
            My Gift Applications
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Track the status of all your applications for Christmas gifts.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-secondary animate-pulse" />
            ))}
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-secondary/40 border border-border/80 rounded-2xl p-12 text-center space-y-3">
            <FolderHeart className="w-12 h-12 text-muted-foreground/60 mx-auto" />
            <h3 className="font-semibold text-base text-foreground">No gift applications yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              You haven't submitted any applications for Christmas gifts. Explore the feed to discover items!
            </p>
            <Link
              to="/giving/browse"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors"
            >
              <span>Browse Christmas Gifts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app: any) => {
              const gift = app.gift;
              const coverImg = gift?.images?.[0] || "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=300&auto=format&fit=crop&q=80";
              const canWithdraw = app.status === "pending" || app.status === "shortlisted";

              return (
                <div
                  key={app.id}
                  className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-xs transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <Link
                      to="/giving/$id"
                      params={{ id: gift?.id }}
                      className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-secondary shrink-0 border border-border"
                    >
                      <img src={coverImg} alt="" className="w-full h-full object-cover" />
                    </Link>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(app.status)}
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(app.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <Link
                        to="/giving/$id"
                        params={{ id: gift?.id }}
                        className="font-semibold text-sm sm:text-base text-foreground hover:text-emerald-700 transition-colors block truncate"
                      >
                        {gift?.title || "Gift Listing"}
                      </Link>

                      <p className="text-xs text-muted-foreground line-clamp-1 italic">
                        "{app.message}"
                      </p>

                      {app.application_type === "someone_else" && app.intended_recipient_description && (
                        <p className="text-[11px] text-amber-700 line-clamp-1">
                          For: {app.intended_recipient_description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {app.status === "selected" && (
                      <Link
                        to="/giving/handover/$id"
                        params={{ id: gift?.id }}
                        className="px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm"
                      >
                        <HeartHandshake className="w-4 h-4" />
                        <span>Arrange Collection</span>
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
                            <AlertDialogTitle>Withdraw Gift Application?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to withdraw your application for "{gift?.title}"? You will not be considered for this gift.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Application</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleWithdraw(app.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Yes, Withdraw
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    <Link
                      to="/giving/$id"
                      params={{ id: gift?.id }}
                      className="px-3.5 py-1.5 rounded-full border border-border text-xs font-medium hover:bg-secondary transition-colors"
                    >
                      View Gift
                    </Link>
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

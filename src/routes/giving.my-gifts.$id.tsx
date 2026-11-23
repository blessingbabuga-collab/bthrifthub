import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Star,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  HeartHandshake,
  User,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { BackButton } from "@/components/BackButton";
import { GivingNav } from "@/components/GivingNav";
import { fetchGiftById, fetchApplicationsForGift } from "@/lib/giving";
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

export const Route = createFileRoute("/giving/my-gifts/$id")({
  component: ManageGiftApplicationsPage,
});

function ManageGiftApplicationsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [filterTab, setFilterTab] = useState<"all" | "shortlisted" | "selected">("all");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: gift, isLoading: giftLoading } = useQuery({
    queryKey: ["gift_detail", id],
    queryFn: () => fetchGiftById(id),
  });

  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ["gift_applications", id],
    queryFn: () => fetchApplicationsForGift(id),
  });

  const handleToggleShortlist = async (applicationId: string, currentStatus: string) => {
    setProcessingId(applicationId);
    try {
      const isShortlisted = currentStatus === "shortlisted";
      const { data, error } = await (supabase as any).rpc("shortlist_gift_applicant", {
        p_application_id: applicationId,
        p_shortlist: !isShortlisted,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Could not update shortlist");

      toast.success(isShortlisted ? "Removed from shortlist" : "Applicant shortlisted! ⭐");
      queryClient.invalidateQueries({ queryKey: ["gift_applications", id] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update applicant");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSelectRecipient = async (applicationId: string, applicantName: string) => {
    setProcessingId(applicationId);
    try {
      const { data, error } = await (supabase as any).rpc("select_gift_recipient", {
        p_gift_id: id,
        p_application_id: applicationId,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Could not select recipient");

      toast.success(`Recipient selected! Proceeding to collection arrangement... 🎁`);
      queryClient.invalidateQueries({ queryKey: ["gift_detail", id] });
      queryClient.invalidateQueries({ queryKey: ["gift_applications", id] });
      navigate({ to: "/giving/handover/$id", params: { id } });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to select recipient");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCloseApplications = async () => {
    try {
      const { error } = await (supabase as any)
        .from("gift_listings")
        .update({ status: "applications_closed", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("giver_id", user!.id);

      if (error) throw error;
      toast.success("Applications are now closed.");
      queryClient.invalidateQueries({ queryKey: ["gift_detail", id] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to close applications");
    }
  };

  if (giftLoading || appsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!gift || (user && user.id !== gift.giver_id)) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Unauthorized or Not Found</h1>
          <p className="text-xs text-muted-foreground">Only the giver can review applications for this gift.</p>
          <Link to="/giving/my-gifts" className="inline-flex px-4 py-2 rounded-full bg-primary text-xs font-semibold">
            Return to My Gifts
          </Link>
        </div>
      </div>
    );
  }

  const isAwarded = gift.status === "awarded" || gift.status === "completed";
  const filteredApps = applications.filter((app: any) => {
    if (filterTab === "shortlisted") return app.status === "shortlisted";
    if (filterTab === "selected") return app.status === "selected";
    return true;
  });

  return (
    <div className="min-h-screen pb-24 sm:pb-0 bg-background">
      <SiteHeader />
      <GivingNav currentPath="/giving/my-gifts" hasActiveUser={true} />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <BackButton fallback="/giving/my-gifts" />

        {/* HEADER */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Application Review & Selection
            </span>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
              {gift.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              Status: <strong className="capitalize text-foreground">{gift.status}</strong> • Total Applications:{" "}
              <strong>{applications.length}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAwarded ? (
              <Link
                to="/giving/handover/$id"
                params={{ id: gift.id }}
                className="px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <HeartHandshake className="w-4 h-4" />
                <span>Go to Handover Tracker</span>
              </Link>
            ) : gift.status === "published" ? (
              <button
                onClick={handleCloseApplications}
                className="px-4 py-2 rounded-full border border-border text-xs font-medium hover:bg-secondary transition-colors"
              >
                Close Applications
              </button>
            ) : null}

            <Link
              to="/giving/$id"
              params={{ id: gift.id }}
              className="px-4 py-2 rounded-full border border-border text-xs font-medium hover:bg-secondary"
            >
              View Public Listing
            </Link>
          </div>
        </div>

        {/* FILTER TABS */}
        <div className="flex items-center gap-2 my-6">
          <button
            onClick={() => setFilterTab("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterTab === "all" ? "bg-foreground text-background font-semibold" : "bg-secondary text-muted-foreground"
            }`}
          >
            All Applications ({applications.length})
          </button>
          <button
            onClick={() => setFilterTab("shortlisted")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterTab === "shortlisted"
                ? "bg-amber-600 text-white font-semibold"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            Shortlisted (
            {applications.filter((a: any) => a.status === "shortlisted").length}
            )
          </button>
          <button
            onClick={() => setFilterTab("selected")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterTab === "selected"
                ? "bg-emerald-700 text-white font-semibold"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            Selected Recipient (
            {applications.filter((a: any) => a.status === "selected").length}
            )
          </button>
        </div>

        {/* APPLICATIONS LIST */}
        {filteredApps.length === 0 ? (
          <div className="bg-secondary/40 border border-border/80 rounded-2xl p-12 text-center space-y-3">
            <Users className="w-12 h-12 text-muted-foreground/60 mx-auto" />
            <h3 className="font-semibold text-base text-foreground">No applications in this view</h3>
            <p className="text-xs text-muted-foreground">
              {filterTab === "all"
                ? "No one has applied for this gift yet. Share your listing to help find someone in need!"
                : "None of the applicants match this filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApps.map((app: any) => {
              const applicant = app.applicant;
              const isSelected = app.status === "selected";
              const isShortlisted = app.status === "shortlisted";
              const isWithdrawn = app.status === "withdrawn";

              return (
                <div
                  key={app.id}
                  className={`bg-card border rounded-2xl p-5 shadow-xs transition-all ${
                    isSelected
                      ? "border-emerald-600 ring-2 ring-emerald-600/20 bg-emerald-50/20"
                      : isShortlisted
                      ? "border-amber-400 bg-amber-50/10"
                      : "border-border/80"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-border/60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden flex items-center justify-center shrink-0 border">
                        {applicant?.avatar_url ? (
                          <img src={applicant.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">
                            {applicant?.full_name || `@${applicant?.username || "Applicant"}`}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            {app.application_type === "self" ? "For Themselves" : "For Someone Else"}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          Applied {new Date(app.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white flex items-center gap-1 shadow-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Selected Recipient
                        </span>
                      )}
                      {isShortlisted && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> Shortlisted
                        </span>
                      )}
                      {app.status === "not_selected" && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs text-muted-foreground bg-muted">
                          Not Selected
                        </span>
                      )}
                      {isWithdrawn && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs text-muted-foreground bg-secondary line-through">
                          Withdrawn by Applicant
                        </span>
                      )}
                    </div>
                  </div>

                  {/* APPLICATION CONTENT */}
                  <div className="space-y-2 mb-4">
                    {app.application_type === "someone_else" && app.intended_recipient_description && (
                      <div className="p-3 rounded-xl bg-secondary/50 border border-border/80">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">
                          Intended Recipient Details:
                        </span>
                        <p className="text-xs text-foreground font-medium">
                          {app.intended_recipient_description}
                        </p>
                      </div>
                    )}

                    <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/60">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                        Application Message (Max 200 characters):
                      </span>
                      <p className="text-sm text-foreground italic leading-relaxed">
                        "{app.message}"
                      </p>
                    </div>
                  </div>

                  {/* ACTION CONTROLS FOR GIVER */}
                  {!isWithdrawn && !isAwarded && (
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border/60">
                      {/* SHORTLIST BUTTON */}
                      <button
                        type="button"
                        disabled={processingId === app.id}
                        onClick={() => handleToggleShortlist(app.id, app.status)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                          isShortlisted
                            ? "border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100"
                            : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${isShortlisted ? "fill-amber-500 text-amber-500" : ""}`} />
                        <span>{isShortlisted ? "Remove Shortlist" : "Shortlist Applicant"}</span>
                      </button>

                      {/* SELECT RECIPIENT ALERT DIALOG */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            type="button"
                            disabled={processingId === app.id}
                            className="px-4 py-1.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Select as Recipient</span>
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Recipient Selection</AlertDialogTitle>
                            <AlertDialogDescription className="space-y-2">
                              <span>
                                Are you sure you want to select <strong>{applicant?.full_name || `@${applicant?.username}`}</strong> as the recipient for this Christmas Gift?
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                This will mark other applicants as Not Selected and transition the gift to Awarded. You will then arrange private collection details.
                              </span>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleSelectRecipient(app.id, applicant?.full_name || "Applicant")}
                              className="bg-emerald-700 text-white hover:bg-emerald-800"
                            >
                              Yes, Select Recipient
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}

                  {isSelected && (
                    <div className="flex items-center justify-between pt-2 text-xs">
                      <span className="text-emerald-700 font-medium">Selected for Christmas Giving</span>
                      <Link
                        to="/giving/handover/$id"
                        params={{ id: gift.id }}
                        className="font-semibold text-emerald-800 underline hover:text-emerald-950 flex items-center gap-1"
                      >
                        <span>Arrange / View Handover</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
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

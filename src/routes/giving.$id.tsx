import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  User,
  HeartHandshake,
  CheckCircle2,
  AlertCircle,
  Share2,
  ShieldAlert,
  Edit,
  ArrowRight,
  ListOrdered,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { BackButton } from "@/components/BackButton";
import { GivingNav } from "@/components/GivingNav";
import { ApplyGiftModal } from "@/components/ApplyGiftModal";
import { ReportGiftModal } from "@/components/ReportGiftModal";
import { fetchGiftById, formatGiverName, fetchFindGiftEnabled, fetchGivingBookingStartDate } from "@/lib/giving";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/giving/$id")({
  component: GiftDetailPage,
});

function GiftDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const { data: gift, isLoading, error } = useQuery({
    queryKey: ["gift_detail", id],
    queryFn: () => fetchGiftById(id),
  });

  const { data: findGiftEnabled = false } = useQuery({
    queryKey: ["giving_find_gift_enabled"],
    queryFn: fetchFindGiftEnabled,
  });

  const { data: bookingStartDate = "2026-12-06" } = useQuery({
    queryKey: ["giving_booking_start_date"],
    queryFn: fetchGivingBookingStartDate,
  });

  // Check if current user already applied
  const { data: userApplication } = useQuery({
    queryKey: ["user_gift_app", id, user?.id],
    enabled: !!user?.id && !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("gift_applications")
        .select("*")
        .eq("gift_id", id)
        .eq("applicant_id", user!.id)
        .neq("status", "withdrawn")
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground animate-pulse">Loading Christmas Gift details...</p>
        </div>
      </div>
    );
  }

  if (error || !gift) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Gift not found or no longer available</h1>
          <p className="text-xs text-muted-foreground">This Christmas Gift may have been withdrawn or removed.</p>
          <Link
            to="/giving/browse"
            className="inline-flex px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
          >
            Browse Other Gifts
          </Link>
        </div>
      </div>
    );
  }

  const isGiver = user?.id === gift.giver_id;
  const isAwarded = gift.status === "awarded";
  const isCompleted = gift.status === "completed";
  const isClosed = gift.status === "applications_closed" || isAwarded || isCompleted;
  const isExpired = gift.deadline && new Date(gift.deadline) < new Date();
  const canApply = user && !isGiver && !isClosed && !isExpired && !userApplication;

  const images = gift.images && gift.images.length > 0 ? gift.images : [];
  const currentImg = images[activeImageIdx] || "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&auto=format&fit=crop&q=80";

  return (
    <div className="min-h-screen pb-24 sm:pb-0 bg-background">
      <SiteHeader />
      <GivingNav currentPath="/giving" hasActiveUser={!!user} />

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-4">
          <BackButton fallback="/giving/browse" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: gift.title, url: window.location.href });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copied to clipboard!");
                }
              }}
              className="p-2 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Share gift"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (!user) {
                  toast.error("Please log in to report a listing");
                  navigate({ to: "/auth" });
                  return;
                }
                setShowReportModal(true);
              }}
              className="p-2 rounded-full border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Report listing"
            >
              <ShieldAlert className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* IMAGE GALLERY */}
          <div className="space-y-3">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-secondary border border-border">
              <img
                src={currentImg}
                alt={gift.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-md">
                  <Sparkles className="w-3.5 h-3.5" /> 100% Free Gift
                </span>
              </div>
            </div>

            {images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {images.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setActiveImageIdx(i)}
                    className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                      activeImageIdx === i ? "border-emerald-600 scale-95" : "border-border opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* GIFT DETAILS & ACTIONS */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span className="font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {gift.category}
                </span>
                <span>•</span>
                <span>{gift.condition}</span>
                {gift.brand && (
                  <>
                    <span>•</span>
                    <span className="font-medium text-foreground">{gift.brand}</span>
                  </>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                {gift.title}
              </h1>

              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{gift.location}</span>
                </div>
                {gift.deadline && (
                  <div className="flex items-center gap-1 text-amber-700 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Applications close {new Date(gift.deadline).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* STATUS BANNER */}
            {isCompleted && (
              <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                <p className="text-xs">
                  This Christmas Gift has been successfully handed over and completed.
                </p>
              </div>
            )}

            {isAwarded && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold">Recipient Selected!</p>
                  <p className="text-emerald-700">The giver has selected a recipient and handover is underway.</p>
                </div>
              </div>
            )}

            {isGiver && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    You are the Giver of this item
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                    Status: {gift.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/giving/my-gifts/$id"
                    params={{ id: gift.id }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs"
                  >
                    <ListOrdered className="w-3.5 h-3.5" /> Manage Applications
                  </Link>
                  {(isAwarded || isCompleted) && (
                    <Link
                      to="/giving/handover/$id"
                      params={{ id: gift.id }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs"
                    >
                      <HeartHandshake className="w-3.5 h-3.5" /> Handover Tracker
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* BENEFICIARY GUIDANCE */}
            {gift.intended_beneficiary_description && (
              <div className="bg-secondary/40 border border-border/80 rounded-2xl p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Intended Beneficiary Guidance
                </span>
                <p className="text-xs text-foreground italic leading-relaxed">
                  "{gift.intended_beneficiary_description}"
                </p>
              </div>
            )}

            {/* SPECIFICATIONS & DETAILS */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Item Details</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {gift.size && (
                  <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/60">
                    <span className="text-muted-foreground block text-[10px] uppercase">Size</span>
                    <span className="font-medium text-foreground">{gift.size}</span>
                  </div>
                )}
                {gift.color && (
                  <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/60">
                    <span className="text-muted-foreground block text-[10px] uppercase">Color</span>
                    <span className="font-medium text-foreground">{gift.color}</span>
                  </div>
                )}
                {gift.specifications && (
                  <div className="col-span-2 p-2.5 rounded-xl bg-secondary/30 border border-border/60">
                    <span className="text-muted-foreground block text-[10px] uppercase">Specs</span>
                    <span className="font-medium text-foreground">{gift.specifications}</span>
                  </div>
                )}
              </div>
            </div>

            {/* DESCRIPTION */}
            {gift.description && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Giver's Note</h3>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {gift.description}
                </p>
              </div>
            )}

            {/* GIVER PROFILE CARD */}
            {gift.giver && (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-secondary/40 border border-border/80">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-amber/20 flex items-center justify-center shrink-0">
                  {gift.giver.avatar_url ? (
                    <img src={gift.giver.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-amber-700" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Offered with love by
                  </span>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {formatGiverName(gift.giver)}
                  </p>
                </div>
              </div>
            )}

            {/* APPLICATION CTA AREA */}
            <div className="pt-2">
              {userApplication ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900">
                      Your Gift Application is {userApplication.status.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-emerald-700">
                      Submitted {new Date(userApplication.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 italic">
                    "{userApplication.message}"
                  </p>
                  <div className="pt-2 flex items-center gap-2">
                    <Link
                      to="/giving/my-applications"
                      className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950"
                    >
                      View all your applications →
                    </Link>
                    {userApplication.status === "selected" && (
                      <Link
                        to="/giving/handover/$id"
                        params={{ id: gift.id }}
                        className="ml-auto px-3.5 py-1.5 rounded-full bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800"
                      >
                        Go to Handover
                      </Link>
                    )}
                  </div>
                </div>
              ) : isGiver ? null : !user ? (
                <Link
                  to="/auth"
                  className="w-full h-13 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-display font-bold text-base shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <User className="w-4 h-4" /> Log in to Apply for this Gift
                </Link>
              ) : isClosed || isExpired ? (
                <div className="p-4 rounded-2xl bg-secondary border border-border text-center text-xs text-muted-foreground">
                  Applications are currently closed for this gift.
                </div>
              ) : !findGiftEnabled && bookingStartDate && new Date() < new Date(bookingStartDate) ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-1.5">
                  <span className="text-xs font-bold text-amber-900 block">
                    Gift Bookings Open on {new Date(bookingStartDate).toLocaleDateString(undefined, { dateStyle: "long" })}
                  </span>
                  <p className="text-[11px] text-amber-800">
                    Gifts are currently being collected from community givers. Public booking and applications will open on this date.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowApplyModal(true)}
                  className="w-full h-14 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-display font-bold uppercase tracking-wider text-base shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <HeartHandshake className="w-5 h-5" /> Apply for this Gift
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* APPLY MODAL */}
      {user && gift && (
        <ApplyGiftModal
          giftId={gift.id}
          giftTitle={gift.title}
          giverId={gift.giver_id}
          applicantId={user.id}
          isOpen={showApplyModal}
          onClose={() => setShowApplyModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["user_gift_app", id, user.id] });
            queryClient.invalidateQueries({ queryKey: ["gift_detail", id] });
          }}
        />
      )}

      {/* REPORT MODAL */}
      {user && gift && (
        <ReportGiftModal
          giftId={gift.id}
          reporterId={user.id}
          title={gift.title}
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
        />
      )}

      <div className="hidden sm:block">
        <SiteFooter />
      </div>
      <MobileNav />
    </div>
  );
}

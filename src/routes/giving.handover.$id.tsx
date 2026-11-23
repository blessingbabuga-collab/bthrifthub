import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  HeartHandshake,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User,
  ArrowRight,
  Info,
  Loader2,
  Lock,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { BackButton } from "@/components/BackButton";
import { GivingNav } from "@/components/GivingNav";
import { fetchGiftById, fetchGiftHandover } from "@/lib/giving";
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

export const Route = createFileRoute("/giving/handover/$id")({
  component: GiftHandoverPage,
});

function GiftHandoverPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    meeting_location: "",
    collection_date: "",
    collection_time: "",
    collection_instructions: "",
  });
  const [submittingArrangement, setSubmittingArrangement] = useState(false);
  const [confirmingStep, setConfirmingStep] = useState<string | null>(null);

  const { data: gift, isLoading: giftLoading } = useQuery({
    queryKey: ["gift_detail", id],
    queryFn: () => fetchGiftById(id),
  });

  const { data: handover, isLoading: handoverLoading } = useQuery({
    queryKey: ["gift_handover", id],
    queryFn: () => fetchGiftHandover(id),
  });

  const isGiver = user?.id === gift?.giver_id;
  const isRecipient = user?.id === handover?.recipient_id;

  const handleSaveArrangements = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.meeting_location.trim() || !form.collection_date || !form.collection_time.trim()) {
      toast.error("Please fill in meeting location, date and time");
      return;
    }

    setSubmittingArrangement(true);
    try {
      const { data, error } = await (supabase as any).rpc("arrange_gift_handover", {
        p_gift_id: id,
        p_meeting_location: form.meeting_location.trim(),
        p_collection_date: form.collection_date,
        p_collection_time: form.collection_time.trim(),
        p_collection_instructions: form.collection_instructions.trim() || null,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Failed to save collection arrangements");

      toast.success("Collection arrangements saved and sent to recipient! 📍");
      queryClient.invalidateQueries({ queryKey: ["gift_handover", id] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save collection arrangements");
    } finally {
      setSubmittingArrangement(false);
    }
  };

  const handleConfirmStep = async (step: "recipient_attendance" | "giver_handover" | "recipient_receipt") => {
    setConfirmingStep(step);
    try {
      const { data, error } = await (supabase as any).rpc("confirm_handover_step", {
        p_gift_id: id,
        p_step: step,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Failed to confirm step");

      if (step === "recipient_receipt") {
        toast.success("Christmas Gift completed! Thank you for spreading holiday joy! 🎄✨");
      } else {
        toast.success("Confirmation recorded successfully! ✅");
      }

      queryClient.invalidateQueries({ queryKey: ["gift_handover", id] });
      queryClient.invalidateQueries({ queryKey: ["gift_detail", id] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to record confirmation");
    } finally {
      setConfirmingStep(null);
    }
  };

  if (giftLoading || handoverLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!gift) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Gift not found</h1>
          <Link to="/giving" className="inline-flex px-4 py-2 rounded-full bg-primary text-xs font-semibold">
            Return to Christmas Giving
          </Link>
        </div>
      </div>
    );
  }

  // Security check: Only giver or selected recipient can see handover details
  if (user && !isGiver && !isRecipient) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
          <Lock className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Confidential Handover Details</h1>
          <p className="text-xs text-muted-foreground">
            Meeting locations, contact information and handover confirmations are private and only visible to the giver and the selected recipient.
          </p>
          <Link to="/giving" className="inline-flex px-4 py-2 rounded-full bg-primary text-xs font-semibold">
            Return to Christmas Giving
          </Link>
        </div>
      </div>
    );
  }

  const hasArrangement = !!handover?.meeting_location;
  const isAttendanceConfirmed = !!handover?.recipient_confirmed_attendance;
  const isHandoverConfirmed = !!handover?.giver_confirmed_handover;
  const isReceiptConfirmed = !!handover?.recipient_confirmed_receipt;
  const isCompleted = isReceiptConfirmed || gift.status === "completed";

  return (
    <div className="min-h-screen pb-24 sm:pb-0 bg-background">
      <SiteHeader />
      <GivingNav currentPath="/giving" hasActiveUser={true} />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <BackButton fallback="/giving/my-gifts" />

        <div className="mt-4 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mb-2">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Private Collection & Handover Tracker</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
            {gift.title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Coordinated, dignified, and safe gift exchange between giver and recipient.
          </p>
        </div>

        {/* CONFIDENTIAL PRIVACY NOTICE */}
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 mb-8">
          <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-0.5">
            <span className="font-semibold block">Privacy Protected Exchange</span>
            <p>
              These collection details are strictly private between you and the other party. We never publish specific handover addresses or residential details publicly.
            </p>
          </div>
        </div>

        {/* 5-STEP CONFIRMATION SEQUENCE TRACKER */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs mb-8 space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Handover Confirmation Sequence
          </h2>

          <div className="space-y-4">
            {/* STEP 1: Giver arranges collection */}
            <div className="flex items-start gap-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  hasArrangement
                    ? "bg-emerald-600 text-white"
                    : "bg-secondary text-muted-foreground border"
                }`}
              >
                {hasArrangement ? <CheckCircle2 className="w-4 h-4" /> : "1"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-foreground">
                  1. Giver arranges collection details
                </p>
                <p className="text-xs text-muted-foreground">
                  {hasArrangement
                    ? "Collection details provided by the giver."
                    : "Waiting for giver to set the meeting location and time."}
                </p>
              </div>
            </div>

            {/* STEP 2: Recipient confirms attendance */}
            <div className="flex items-start gap-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isAttendanceConfirmed
                    ? "bg-emerald-600 text-white"
                    : "bg-secondary text-muted-foreground border"
                }`}
              >
                {isAttendanceConfirmed ? <CheckCircle2 className="w-4 h-4" /> : "2"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-foreground">
                  2. Recipient confirms attendance
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAttendanceConfirmed
                    ? `Attendance confirmed on ${new Date(handover.recipient_attendance_confirmed_at).toLocaleDateString()}`
                    : "Recipient reviews arrangement and confirms they can attend."}
                </p>
              </div>
            </div>

            {/* STEP 3: Giver confirms handover */}
            <div className="flex items-start gap-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isHandoverConfirmed
                    ? "bg-emerald-600 text-white"
                    : "bg-secondary text-muted-foreground border"
                }`}
              >
                {isHandoverConfirmed ? <CheckCircle2 className="w-4 h-4" /> : "3"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-foreground">
                  3. Giver confirms handover
                </p>
                <p className="text-xs text-muted-foreground">
                  {isHandoverConfirmed
                    ? `Handed over on ${new Date(handover.giver_handover_confirmed_at).toLocaleDateString()}`
                    : "Giver meets recipient and confirms giving the item."}
                </p>
              </div>
            </div>

            {/* STEP 4: Recipient confirms receipt */}
            <div className="flex items-start gap-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isReceiptConfirmed
                    ? "bg-emerald-600 text-white"
                    : "bg-secondary text-muted-foreground border"
                }`}
              >
                {isReceiptConfirmed ? <CheckCircle2 className="w-4 h-4" /> : "4"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-foreground">
                  4. Recipient confirms receipt
                </p>
                <p className="text-xs text-muted-foreground">
                  {isReceiptConfirmed
                    ? `Receipt confirmed on ${new Date(handover.recipient_receipt_confirmed_at).toLocaleDateString()}`
                    : "Recipient confirms receiving the item safely."}
                </p>
              </div>
            </div>

            {/* STEP 5: System records completion */}
            <div className="flex items-start gap-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isCompleted
                    ? "bg-emerald-600 text-white"
                    : "bg-secondary text-muted-foreground border"
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : "5"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-foreground">
                  5. Christmas Giving Completed
                </p>
                <p className="text-xs text-muted-foreground">
                  {isCompleted
                    ? "Gift successfully recorded as completed. A brighter Christmas delivered!"
                    : "Final status recorded once both confirmations are verified."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* DETAILS SECTION */}
        {hasArrangement ? (
          <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs mb-8 space-y-4">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-700" />
              Arranged Collection Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-secondary/40 border border-border/60">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                  Meeting Location
                </span>
                <p className="font-semibold text-foreground">{handover.meeting_location}</p>
              </div>

              <div className="p-3 rounded-xl bg-secondary/40 border border-border/60">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                  Collection Date & Time
                </span>
                <p className="font-semibold text-foreground">
                  {new Date(handover.collection_date).toLocaleDateString()} at {handover.collection_time}
                </p>
              </div>

              {handover.collection_instructions && (
                <div className="col-span-1 sm:col-span-2 p-3 rounded-xl bg-secondary/40 border border-border/60">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                    Special Instructions
                  </span>
                  <p className="text-foreground leading-relaxed">{handover.collection_instructions}</p>
                </div>
              )}
            </div>

            {/* ACTION CONFIRMATION BUTTONS */}
            <div className="pt-4 border-t border-border flex flex-wrap gap-3">
              {/* Recipient confirms attendance */}
              {isRecipient && !isAttendanceConfirmed && (
                <button
                  type="button"
                  disabled={confirmingStep !== null}
                  onClick={() => handleConfirmStep("recipient_attendance")}
                  className="px-5 py-2.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-transform active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm My Attendance</span>
                </button>
              )}

              {/* Giver confirms handover */}
              {isGiver && !isHandoverConfirmed && (
                <button
                  type="button"
                  disabled={confirmingStep !== null}
                  onClick={() => handleConfirmStep("giver_handover")}
                  className="px-5 py-2.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-transform active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm I Have Handed Over the Item</span>
                </button>
              )}

              {/* Recipient confirms receipt (only active after giver confirms handover) */}
              {isRecipient && isHandoverConfirmed && !isReceiptConfirmed && (
                <button
                  type="button"
                  disabled={confirmingStep !== null}
                  onClick={() => handleConfirmStep("recipient_receipt")}
                  className="px-5 py-2.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-transform active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm I Have Received the Gift</span>
                </button>
              )}
            </div>

            {/* RECIPIENT FEEDBACK SECTION */}
            {isReceiptConfirmed && (
              <div className="pt-6 border-t border-border/80 space-y-4">
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-semibold text-sm">Recipient Thank-You Note & Experience</h4>
                </div>

                {handover.recipient_feedback ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">Thank-you message from Recipient:</span>
                      <span className="text-[11px] text-emerald-700">
                        {new Date(handover.recipient_feedback_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="italic text-emerald-900 leading-relaxed">
                      "{handover.recipient_feedback}"
                    </p>
                  </div>
                ) : isRecipient ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const txt = (new FormData(e.currentTarget).get("feedback") as string)?.trim();
                      if (!txt) {
                        toast.error("Please enter a thank-you note");
                        return;
                      }
                      try {
                        const { data, error } = await (supabase as any).rpc("submit_handover_feedback", {
                          p_gift_id: id,
                          p_feedback: txt,
                          p_rating: 5,
                        });
                        if (error) throw error;
                        toast.success("Thank-you feedback shared! You closed the circle of kindness. ❤️");
                        queryClient.invalidateQueries({ queryKey: ["gift_handover", id] });
                      } catch (err: any) {
                        toast.error(err.message || "Failed to submit feedback");
                      }
                    }}
                    className="space-y-3 p-4 rounded-xl bg-secondary/40 border border-border/80"
                  >
                    <label className="block text-xs font-semibold text-foreground">
                      Share a Thank-You Note to the Giver
                    </label>
                    <textarea
                      name="feedback"
                      rows={3}
                      required
                      placeholder="Tell the giver how much this gift meant to you or your family this Christmas..."
                      className="w-full p-3 rounded-xl bg-background border border-border text-xs resize-none focus:outline-none focus:border-emerald-600"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs"
                    >
                      Send Thank-You Note
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Awaiting recipient thank-you feedback.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : isGiver ? (
          /* GIVER FORM TO ARRANGE COLLECTION */
          <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs mb-8">
            <h3 className="text-base font-semibold text-foreground mb-1">
              Arrange Meeting & Collection Details
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Enter a safe public meeting spot (e.g. shopping mall lobby, fuel station, cafe) and scheduled time.
            </p>

            <form onSubmit={handleSaveArrangements} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Meeting Location <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Outside Ikeja City Mall main entrance or TotalEnergies service station"
                  value={form.meeting_location}
                  onChange={(e) => setForm({ ...form, meeting_location: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl bg-secondary/30 border border-border text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Collection Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split("T")[0]}
                    value={form.collection_date}
                    onChange={(e) => setForm({ ...form, collection_date: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl bg-secondary/30 border border-border text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Collection Time <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2:00 PM - 3:30 PM"
                    value={form.collection_time}
                    onChange={(e) => setForm({ ...form, collection_time: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl bg-secondary/30 border border-border text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Special Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Call my phone when you arrive; I will be wearing a red cap..."
                  value={form.collection_instructions}
                  onChange={(e) => setForm({ ...form, collection_instructions: e.target.value })}
                  className="w-full p-3 rounded-xl bg-secondary/30 border border-border text-xs resize-none focus:outline-none focus:border-emerald-600"
                />
              </div>

              <button
                type="submit"
                disabled={submittingArrangement}
                className="w-full h-12 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-95"
              >
                {submittingArrangement ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" /> Save Collection Details & Notify Recipient
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-secondary/40 border border-border/80 rounded-2xl p-8 text-center space-y-3 mb-8">
            <Clock className="w-10 h-10 text-muted-foreground mx-auto" />
            <h3 className="font-semibold text-base text-foreground">Awaiting Collection Details</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              The giver is currently setting the meeting location and collection time. You will receive a notification as soon as it's ready.
            </p>
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

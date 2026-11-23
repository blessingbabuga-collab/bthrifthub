import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, AlertCircle, HeartHandshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendGivingNotification } from "@/lib/giving";
import { sendPlatformEmail } from "@/lib/resend";
import { toast } from "sonner";

interface ApplyGiftModalProps {
  giftId: string;
  giftTitle: string;
  giverId: string;
  applicantId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_JUSTIFICATION_LENGTH = 200;

export function ApplyGiftModal({
  giftId,
  giftTitle,
  giverId,
  applicantId,
  isOpen,
  onClose,
  onSuccess,
}: ApplyGiftModalProps) {
  const [applicationType, setApplicationType] = useState<"self" | "someone_else">("self");
  const [intendedRecipientDescription, setIntendedRecipientDescription] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const charCount = message.length;
  const isOverLimit = charCount > MAX_JUSTIFICATION_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("Please enter a justification message");
      return;
    }
    if (isOverLimit) {
      toast.error(`Message cannot exceed ${MAX_JUSTIFICATION_LENGTH} characters`);
      return;
    }
    if (applicationType === "someone_else" && !intendedRecipientDescription.trim()) {
      toast.error("Please describe who this gift is for and why they need it");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from("gift_applications").insert({
        gift_id: giftId,
        applicant_id: applicantId,
        application_type: applicationType,
        intended_recipient_description:
          applicationType === "someone_else" ? intendedRecipientDescription.trim() : null,
        message: message.trim(),
        status: "pending",
      });

      if (error) {
        if (error.code === "23505" || error.message?.includes("idx_unique_active_gift_application")) {
          throw new Error("You already have an active application for this gift.");
        }
        throw error;
      }

      // Notify the giver (in-app + email)
      await sendGivingNotification({
        user_id: giverId,
        title: "New Gift Application! 🎁",
        message: `Someone just applied for your gift "${giftTitle}".`,
        link_url: `/giving/my-gifts/${giftId}`,
        entity_id: giftId,
      });

      sendPlatformEmail({
        event_type: "gift_application_received",
        target_user_id: giverId,
        variables: {
          giver_name: "Giver",
          gift_title: giftTitle,
          application_message: message.trim(),
          review_url: `${window.location.origin}/giving/my-gifts/${giftId}`,
        },
      }).catch(() => {});

      toast.success("Gift Application submitted successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit gift application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !submitting && !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-700">
            <HeartHandshake className="w-5 h-5" />
            <DialogTitle className="text-xl">Apply for this Gift</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-xs">
            Applying for: <strong className="text-foreground">{giftTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* RECIPIENT TYPE SELECTION */}
          <div>
            <Label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-2">
              Who is this gift for?
            </Label>
            <RadioGroup
              value={applicationType}
              onValueChange={(val: any) => setApplicationType(val)}
              className="grid grid-cols-2 gap-3"
            >
              <div
                className={`flex items-center space-x-2 border rounded-xl p-3 cursor-pointer transition-colors ${
                  applicationType === "self" ? "border-amber bg-amber/5" : "border-border hover:bg-secondary/40"
                }`}
                onClick={() => setApplicationType("self")}
              >
                <RadioGroupItem value="self" id="self" />
                <Label htmlFor="self" className="text-xs font-medium cursor-pointer">
                  For Myself
                </Label>
              </div>

              <div
                className={`flex items-center space-x-2 border rounded-xl p-3 cursor-pointer transition-colors ${
                  applicationType === "someone_else"
                    ? "border-amber bg-amber/5"
                    : "border-border hover:bg-secondary/40"
                }`}
                onClick={() => setApplicationType("someone_else")}
              >
                <RadioGroupItem value="someone_else" id="someone_else" />
                <Label htmlFor="someone_else" className="text-xs font-medium cursor-pointer">
                  Someone Else
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* SOMEONE ELSE DETAILS */}
          {applicationType === "someone_else" && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <Label className="text-xs font-semibold text-foreground">
                Intended Recipient Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                rows={2}
                value={intendedRecipientDescription}
                onChange={(e) => setIntendedRecipientDescription(e.target.value)}
                placeholder="e.g. My younger sister starting secondary school or a neighbour in need..."
                className="text-xs resize-none bg-secondary/30"
                required
              />
            </div>
          )}

          {/* JUSTIFICATION MESSAGE WITH LIVE 200 CHAR COUNTER */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">
                Justification Message <span className="text-destructive">*</span>
              </Label>
              <span
                className={`text-[11px] font-mono font-medium ${
                  isOverLimit ? "text-destructive" : charCount >= 180 ? "text-amber-600" : "text-muted-foreground"
                }`}
              >
                {charCount}/{MAX_JUSTIFICATION_LENGTH}
              </span>
            </div>
            <Textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain briefly why this gift would make a difference this Christmas..."
              className={`text-xs resize-none bg-secondary/30 ${isOverLimit ? "border-destructive focus-visible:ring-destructive" : ""}`}
              required
            />
            {isOverLimit && (
              <p className="flex items-center gap-1 text-[11px] text-destructive">
                <AlertCircle className="w-3 h-3" />
                Message must be {MAX_JUSTIFICATION_LENGTH} characters or less.
              </p>
            )}
          </div>

          <div className="bg-secondary/40 p-3 rounded-xl border border-border/80 text-[11px] text-muted-foreground leading-relaxed">
            Note: All Christmas Gifts are 100% free. The giver will review all applications intentionally and select one recipient.
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || isOverLimit || !message.trim()}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
                </>
              ) : (
                "Submit Gift Application"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

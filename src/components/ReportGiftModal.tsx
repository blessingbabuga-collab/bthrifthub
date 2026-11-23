import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldAlert } from "lucide-react";
import { submitGiftReport } from "@/lib/giving";
import { toast } from "sonner";

interface ReportGiftModalProps {
  giftId?: string;
  applicationId?: string;
  reporterId: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ReportGiftModal({
  giftId,
  applicationId,
  reporterId,
  title,
  isOpen,
  onClose,
}: ReportGiftModalProps) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      toast.error("Please select a reason for the report");
      return;
    }

    setSubmitting(true);
    try {
      await submitGiftReport({
        reporter_id: reporterId,
        gift_id: giftId,
        application_id: applicationId,
        reason,
        details: details.trim() || undefined,
      });

      toast.success("Thank you. Report received and sent for moderation.");
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !submitting && !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-5 h-5" />
            <DialogTitle className="text-lg">Report to Moderation</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-xs">
            Report inappropriate listing or behavior regarding: <strong className="text-foreground">{title}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Reason for Report</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="w-full bg-secondary/30 text-xs">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inappropriate_content">Inappropriate Content or Language</SelectItem>
                <SelectItem value="suspected_scam">Suspected Scam or False Gift</SelectItem>
                <SelectItem value="asking_for_money">Giver Asking for Money or Delivery Fees</SelectItem>
                <SelectItem value="prohibited_goods">Stolen, Counterfeit or Prohibited Goods</SelectItem>
                <SelectItem value="harassment">Harassment or Abusive Behavior</SelectItem>
                <SelectItem value="other">Other Violation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Additional Details (Optional)</Label>
            <Textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide any additional context to help our moderation team review this item..."
              className="text-xs resize-none bg-secondary/30"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={submitting || !reason}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
                </>
              ) : (
                "Submit Report"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

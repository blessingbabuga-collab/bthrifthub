import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Save, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { sendPlatformEmail } from "@/lib/resend";

export function AdminResendSettings() {
  const queryClient = useQueryClient();
  const [fromName, setFromName] = useState("BTHRIFTS");
  const [fromEmail, setFromEmail] = useState("notifications@resend.dev");
  const [replyTo, setReplyTo] = useState("support@thriftyfy.africa");
  const [testRecipient, setTestRecipient] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-resend-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .in("key", ["resend_from_name", "resend_from_email", "resend_reply_to"]);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (settings) {
      for (const s of settings) {
        if (s.key === "resend_from_name" && s.value) setFromName(s.value);
        if (s.key === "resend_from_email" && s.value) setFromEmail(s.value);
        if (s.key === "resend_reply_to" && s.value) setReplyTo(s.value);
      }
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: "resend_from_name", value: fromName.trim(), description: "Default sender name for official platform emails" },
        { key: "resend_from_email", value: fromEmail.trim(), description: "Default sender email address registered/verified on Resend" },
        { key: "resend_reply_to", value: replyTo.trim(), description: "Reply-to email address for customer inquiries" },
      ];

      for (const item of updates) {
        const { error } = await supabase
          .from("platform_settings")
          .upsert({ ...item, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Resend official email settings saved!");
      queryClient.invalidateQueries({ queryKey: ["admin-resend-settings"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update email settings");
    },
  });

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient || !testRecipient.includes("@")) {
      toast.error("Please enter a valid recipient email address for testing");
      return;
    }

    setTestingEmail(true);
    try {
      const res = await sendPlatformEmail({
        event_type: "test_verification",
        recipient_email: testRecipient.trim(),
        subject: `[Test] Official BTHRIFTS Resend Verification Email`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
            <h2 style="color: #0f172a; margin-top: 0;">Resend is Connected! 🚀</h2>
            <p style="color: #334155; line-height: 1.6;">
              This is a test notification confirming that <strong>${fromName}</strong> (${fromEmail}) is configured and operating as your official communication channel.
            </p>
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #475569;">
              <strong>Reply-To:</strong> ${replyTo}<br />
              <strong>Timestamp:</strong> ${new Date().toISOString()}
            </div>
            <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">
              Thriftyfy / Bthrifts Platform Messaging Services
            </p>
          </div>
        `,
      });

      if (res.success) {
        toast.success(`Test email dispatched successfully via Resend! (ID: ${res.messageId || "sent"})`);
      } else {
        toast.error(`Resend test failed: ${res.error}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send test email");
    } finally {
      setTestingEmail(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-slate-500 animate-pulse">Loading email settings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in">
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/60">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Official Resend Email Configuration</h2>
            <p className="text-sm text-muted-foreground">
              Manage the official sender name, email address, and reply-to for transactional & customer communications.
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
          className="space-y-5"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Official Sender Name
              </label>
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="e.g. BTHRIFTS or Thriftyfy"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Sender Email (Verified on Resend)
              </label>
              <input
                type="text"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="e.g. orders@yourdomain.com or notifications@resend.dev"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Use your verified custom domain from Resend (e.g. <code>hello@thriftyfy.africa</code>) or default testing address.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Reply-To Email Address
            </label>
            <input
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="e.g. support@thriftyfy.africa"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{updateMutation.isPending ? "Saving..." : "Save Settings"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Test Email Dispatcher */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Send Test Email via Resend</h3>
            <p className="text-xs text-muted-foreground">Verify that your Resend API credentials and sender address deliver properly.</p>
          </div>
        </div>

        <form onSubmit={handleTestEmail} className="flex flex-col sm:flex-row gap-3 mt-4">
          <input
            type="email"
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            placeholder="Enter your email to receive a test message"
            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={testingEmail}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{testingEmail ? "Sending..." : "Send Test"}</span>
          </button>
        </form>

        <div className="mt-4 p-4 rounded-2xl bg-secondary/50 border border-border/60 text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Resend Secret Configuration:</span>
          </div>
          <p>
            Ensure <code>RESEND_API_KEY</code> is set in your Supabase Edge Function Secrets. If you just registered on Resend, your API key can be copied from the Resend Dashboard under <strong>API Keys</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}

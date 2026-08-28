import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
  head: () => ({ meta: [{ title: "Reset password — Bthrifts" }] }),
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <BackButton fallback="/auth" />
          <div><Logo className="h-10 sm:h-12 w-auto mx-auto" /></div>
        </div>
        <h1 className="font-display text-4xl tracking-tight mt-2">Forgot password?</h1>
        <p className="text-base text-muted-foreground mt-2">
          We'll email you a secure link to set a new one.
        </p>
        {sent ? (
          <div className="mt-6 text-sm text-center text-muted-foreground bg-secondary rounded-xl p-4">
            Check <span className="text-foreground font-medium">{email}</span> for the reset link. It expires in 1 hour.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full h-12 px-4 rounded-xl bg-input border border-border outline-none focus:border-primary" />
            <button disabled={loading} type="submit" className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold shadow-glow disabled:opacity-60 transition-transform active:scale-95">
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <p className="text-xs text-muted-foreground mt-5">
          Remembered it? <Link to="/auth" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
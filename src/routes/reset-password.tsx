import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  ssr: false,
  head: () => ({ meta: [{ title: "Set new password — Bthrifts" }] }),
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase places a recovery token in the URL hash; the client SDK consumes it
    // automatically and emits a PASSWORD_RECOVERY event with a temporary session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    if (password.length < 6) { toast.error("Use at least 6 characters"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated. You're signed in.");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-hero flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-8 shadow-glow">
        <Link to="/" className="block"><Logo className="h-10 mx-auto" /></Link>
        <h1 className="font-display text-3xl text-center mt-6">Set new password</h1>
        {!ready ? (
          <p className="text-sm text-muted-foreground text-center mt-4">
            Open this page from the link in your email. The link may have expired — <Link to="/forgot-password" className="text-amber">request a new one</Link>.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className="w-full h-12 px-4 rounded-xl bg-input border border-border outline-none focus:border-amber" />
            <input required type="password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" className="w-full h-12 px-4 rounded-xl bg-input border border-border outline-none focus:border-amber" />
            <button disabled={loading} type="submit" className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-60">
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
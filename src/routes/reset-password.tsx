import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col">
        <div className="block"><Logo className="h-10 sm:h-12 w-auto mx-auto" /></div>
        <h1 className="font-display text-3xl text-center mt-6">Set new password</h1>
        {!ready ? (
          <p className="text-sm text-muted-foreground text-center mt-4">
            Open this page from the link in your email. The link may have expired — <Link to="/forgot-password" className="text-primary font-medium hover:underline">request a new one</Link>.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="relative">
              <input required type={showPassword ? "text" : "password"} minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className="w-full h-12 pl-4 pr-12 rounded-xl bg-input border border-border outline-none focus:border-primary" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <div className="relative">
              <input required type={showPassword ? "text" : "password"} minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" className="w-full h-12 pl-4 pr-12 rounded-xl bg-input border border-border outline-none focus:border-primary" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button disabled={loading} type="submit" className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold shadow-glow disabled:opacity-60 transition-transform active:scale-95">
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
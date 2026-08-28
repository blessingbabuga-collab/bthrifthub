import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — Bthrifts" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/" });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: "https://bthrifthub.vercel.app",
            data: { full_name: fullName, username },
          },
        });
        if (error) throw error;
        toast.success("Account created — check your email to confirm.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-12 sm:items-center sm:justify-center">
      <div className="w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <BackButton fallback="/" />
          <div><Logo className="h-10 sm:h-12 w-auto" /></div>
        </div>
        <h1 className="font-display text-4xl mt-2 tracking-tight">
          {mode === "signin" ? "Welcome back" : "Join Bthrifts"}
        </h1>
        <p className="text-base text-muted-foreground mt-2">
          {mode === "signin" ? "Sign in to buy, sell and chat." : "Create an account to start thrifting."}
        </p>

        <form suppressHydrationWarning onSubmit={handleEmail} className="space-y-3 mt-6">
          {mode === "signup" && (
            <>
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="w-full h-12 px-4 rounded-xl bg-input border border-border outline-none focus:border-primary" suppressHydrationWarning />
              <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full h-12 px-4 rounded-xl bg-input border border-border outline-none focus:border-primary" suppressHydrationWarning />
            </>
          )}
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full h-12 px-4 rounded-xl bg-input border border-border outline-none focus:border-primary" suppressHydrationWarning />
          <div className="relative">
            <input required type={showPassword ? "text" : "password"} minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full h-12 pl-4 pr-12 rounded-xl bg-input border border-border outline-none focus:border-primary" suppressHydrationWarning />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1" aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {mode === "signin" && (
            <div className="text-right -mt-1">
              <Link to="/forgot-password" className="text-xs text-primary font-medium hover:underline">Forgot password?</Link>
            </div>
          )}
          <button disabled={loading} type="submit" className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold shadow-glow disabled:opacity-60 transition-transform active:scale-95">
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-5">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-amber">
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
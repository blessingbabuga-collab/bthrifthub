import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { BackButton } from "@/components/BackButton";
import { sendPlatformEmail } from "@/lib/resend";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck, FileText, Check } from "lucide-react";
import { LegalDocumentModal } from "@/components/legal/LegalDocumentModal";

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
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [loading, setLoading] = useState(false);

  // Legal Modal Viewer state
  const [activeModal, setActiveModal] = useState<"terms" | "privacy" | null>(null);
  const [agreements, setAgreements] = useState<Record<string, { title: string; content: string; version: number }>>({});

  useEffect(() => {
    // Fetch current legal agreements
    (supabase as any)
      .from("legal_agreements")
      .select("id, title, content, version")
      .then(({ data }: any) => {
        if (data) {
          const map: Record<string, any> = {};
          data.forEach((item: any) => {
            map[item.id] = item;
          });
          setAgreements(map);
        }
      });
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/" });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup") {
      if (!agreeTerms || !agreePrivacy) {
        toast.error("Please agree to both the Terms and Conditions and the Privacy Agreement to proceed.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: "https://bthrifthub.vercel.app",
            data: { full_name: fullName, username },
          },
        });
        if (error) throw error;

        const newUserId = signUpData.user?.id;
        if (newUserId) {
          // Record both legal consents
          const termsObj = agreements["terms_and_conditions"];
          const privacyObj = agreements["privacy_policy"];

          const consentsToInsert = [];
          if (termsObj) {
            consentsToInsert.push({
              user_id: newUserId,
              agreement_id: "terms_and_conditions",
              version: termsObj.version || 1,
              agreement_title: termsObj.title || "Terms and Conditions",
              agreement_content_snapshot: termsObj.content || "",
            });
          }
          if (privacyObj) {
            consentsToInsert.push({
              user_id: newUserId,
              agreement_id: "privacy_policy",
              version: privacyObj.version || 1,
              agreement_title: privacyObj.title || "Privacy Agreement",
              agreement_content_snapshot: privacyObj.content || "",
            });
          }

          if (consentsToInsert.length > 0) {
            await (supabase as any).from("user_legal_consents").insert(consentsToInsert).catch(() => {});
          }
        }

        // Dispatch Welcome Email via Resend
        sendPlatformEmail({
          event_type: "welcome_user",
          recipient_email: email,
          variables: {
            user_name: fullName || username || "there",
            email: email,
          },
        }).catch(() => {});

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

          {mode === "signup" && (
            <div className="space-y-2 pt-1 text-xs text-muted-foreground">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  required
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0 accent-emerald-600"
                />
                <span className="leading-tight">
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveModal("terms");
                    }}
                    className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Terms and Conditions
                  </button>
                  <span className="text-destructive font-bold ml-0.5">*</span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  required
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0 accent-emerald-600"
                />
                <span className="leading-tight">
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveModal("privacy");
                    }}
                    className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Privacy Agreement
                  </button>
                  <span className="text-destructive font-bold ml-0.5">*</span>
                </span>
              </label>
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

        {/* Legal Modals */}
        <LegalDocumentModal
          isOpen={activeModal === "terms"}
          onClose={() => setActiveModal(null)}
          title={agreements["terms_and_conditions"]?.title || "Terms and Conditions"}
          content={agreements["terms_and_conditions"]?.content || "No terms available."}
        />
        <LegalDocumentModal
          isOpen={activeModal === "privacy"}
          onClose={() => setActiveModal(null)}
          title={agreements["privacy_policy"]?.title || "Privacy Agreement"}
          content={agreements["privacy_policy"]?.content || "No privacy policy available."}
        />
      </div>
    </div>
  );
}
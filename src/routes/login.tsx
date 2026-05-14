import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/login")({
  component: Login,
  head: () => ({ meta: [{ title: "Sign in — Bthrifs" }] }),
});

function Login() {
  return (
    <div className="min-h-screen bg-hero flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-8 shadow-glow">
        <Logo className="h-10 mx-auto" />
        <h1 className="font-display text-3xl text-center mt-6">Welcome back</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">Sign in to buy, sell and chat.</p>
        <form className="mt-6 space-y-3">
          <input placeholder="Phone or email" className="w-full h-12 px-4 rounded-xl bg-input border border-border outline-none focus:border-amber" />
          <input type="password" placeholder="Password" className="w-full h-12 px-4 rounded-xl bg-input border border-border outline-none focus:border-amber" />
          <button type="button" className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold shadow-glow">Continue</button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-5">
          New here? <Link to="/sell" className="text-amber">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

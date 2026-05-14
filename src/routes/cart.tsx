import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";

export const Route = createFileRoute("/cart")({ component: Page });

function Page() {
  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h1 className="font-display text-5xl capitalize">cart</h1>
        <p className="mt-3 text-muted-foreground">Coming soon — your cart will live here.</p>
      </div>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}

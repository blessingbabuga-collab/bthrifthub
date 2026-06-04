import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function BackButton({ fallback = "/", label }: { fallback?: string; label?: string }) {
  const router = useRouter();
  const onClick = () => {
    if (window.history.length > 1) router.history.back();
    else router.navigate({ to: fallback });
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Go back"
      className="inline-flex items-center gap-1.5 h-9 pl-2 pr-3 rounded-full border border-border bg-card hover:bg-secondary text-sm transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      {label ?? "Back"}
    </button>
  );
}
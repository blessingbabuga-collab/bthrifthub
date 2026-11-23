import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gift, PlusCircle, FolderHeart, ListOrdered, Sparkles } from "lucide-react";
import { fetchFindGiftEnabled } from "@/lib/giving";

interface GivingNavProps {
  currentPath?: string;
  hasActiveUser?: boolean;
}

export function GivingNav({ currentPath, hasActiveUser = true }: GivingNavProps) {
  const { data: findGiftEnabled = false } = useQuery({
    queryKey: ["giving_find_gift_enabled"],
    queryFn: fetchFindGiftEnabled,
  });

  const links = [
    { to: "/giving", label: "Overview", icon: Gift, exact: true },
    ...(findGiftEnabled ? [{ to: "/giving/browse", label: "Find a Gift", icon: Sparkles }] : []),
    ...(hasActiveUser
      ? [
          { to: "/giving/create", label: "Give a Gift", icon: PlusCircle },
          { to: "/giving/my-gifts", label: "My Given Gifts", icon: ListOrdered },
          { to: "/giving/my-applications", label: "My Applications", icon: FolderHeart },
        ]
      : []),
  ];

  return (
    <div className="bg-card border-b border-border sticky top-16 z-30 shadow-xs">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-2.5">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = link.exact
              ? currentPath === link.to
              : currentPath?.startsWith(link.to);

            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

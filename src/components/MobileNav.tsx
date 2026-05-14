import { Link } from "@tanstack/react-router";
import { Home, Search, Heart, ShoppingBag, User } from "lucide-react";

const items = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/browse", label: "Browse", Icon: Search },
  { to: "/wishlist", label: "Saved", Icon: Heart },
  { to: "/cart", label: "Cart", Icon: ShoppingBag },
  { to: "/login", label: "Me", Icon: User },
] as const;

export function MobileNav() {
  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border">
      <ul className="grid grid-cols-5 px-2 py-1.5 safe-area">
        {items.map(({ to, label, Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeProps={{ className: "text-amber" }}
              className="flex flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

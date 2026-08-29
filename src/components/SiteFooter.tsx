import { Logo } from "./Logo";
import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-12 grid gap-8 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo className="h-10" />
          <p className="mt-4 text-sm text-muted-foreground max-w-sm">
            A social-commerce thrift marketplace. Discover, buy and sell affordable thrift — securely.
          </p>
        </div>
        <div>
          <h4 className="font-display text-amber tracking-widest text-sm">Shop</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Women</li><li>Men</li><li>Shoes</li><li>Bags</li><li>Accessories</li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-amber tracking-widest text-sm">Company</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/page/$slug" params={{ slug: "about" }} className="hover:text-foreground transition-colors">About</Link></li>
            <li><Link to="/page/$slug" params={{ slug: "sell-on-bthrifs" }} className="hover:text-foreground transition-colors">Sell on Bthrifs</Link></li>
            <li><Link to="/page/$slug" params={{ slug: "help-center" }} className="hover:text-foreground transition-colors">Help Center</Link></li>
            <li><Link to="/page/$slug" params={{ slug: "trust-and-safety" }} className="hover:text-foreground transition-colors">Trust &amp; Safety</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Bthrifs Marketplace. Thrift, reimagined.
      </div>
    </footer>
  );
}

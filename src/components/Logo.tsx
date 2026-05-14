import logo from "@/assets/bthrifs-logo.png";
import { Link } from "@tanstack/react-router";

export function Logo({ className = "h-9" }: { className?: string }) {
  return (
    <Link to="/" className="inline-flex items-center" aria-label="Bthrifs home">
      <img src={logo} alt="Bthrifs — Thrift & Style" className={className} />
    </Link>
  );
}

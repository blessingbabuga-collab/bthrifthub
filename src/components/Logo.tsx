import logo from "@/assets/thriftyfy-logo.png";
import { Link } from "@tanstack/react-router";

export function Logo({ className = "h-8 sm:h-10 w-auto" }: { className?: string }) {
  return (
    <Link to="/" className="inline-flex items-center" aria-label="Thriftyfy home">
      <img src={logo} alt="Thriftyfy — Redefining Thrift" className={`${className} object-contain`} />
    </Link>
  );
}

"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { WalletButton } from "./WalletButton";
import { ThemeToggle } from "./ThemeToggle";

const NAV_LINKS = [
  { href: "/", label: "Pool" },
  { href: "/agents", label: "Agents" },
  { href: "/swap", label: "Swap" },
  { href: "/liquidity", label: "Liquidity" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
  { href: "/demo", label: "Demo" },
];

export function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--card)] px-4 sm:px-6 py-3 sm:py-4">
      {/* Top row: logo + hamburger (mobile) / full nav (desktop) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xl font-bold text-[var(--accent)] hover:opacity-90 transition">
            ⚔️ EvoArena
          </Link>
          <span className="text-xs text-[var(--muted)] hidden sm:inline border border-[var(--border)] rounded px-2 py-0.5">
            Powered by BNB Chain
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1 text-sm">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-lg transition ${
                  isActive
                    ? "bg-[var(--accent)] text-[#0B0E11] font-bold"
                    : "text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--card-hover)]"
                }`}
              >
                {label}
              </Link>
            );
          })}
          <div className="ml-2 flex items-center gap-2">
            <ThemeToggle />
            <WalletButton />
          </div>
        </div>

        {/* Mobile: wallet + theme + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <WalletButton />
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden mt-3 flex flex-col gap-1 border-t border-[var(--border)] pt-3">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`px-3 py-2 rounded-lg transition text-sm ${
                  isActive
                    ? "bg-[var(--accent)] text-[#0B0E11] font-bold"
                    : "text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--card-hover)]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}

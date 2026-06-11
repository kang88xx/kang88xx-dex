"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, ShieldCheck, PieChart } from "lucide-react";
import { WalletButton } from "./WalletButton";
import { ThemeToggle } from "./ThemeToggle";
import { GlyphX } from "./IOILogo";

const LINKS = [
  { href: "/", label: "Swap" },
  { href: "/pools", label: "Pools" },
  { href: "/bridge", label: "Bridge" },
  { href: "/staking", label: "Staking", soon: true },
  { href: "/airdrop", label: "Airdrop" },
  { href: "/games", label: "Games" },
] as { href: string; label: string; soon?: boolean }[];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <GlyphX size={26} />
            <span className="text-lg font-semibold tracking-[0.2em]">IOI</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) =>
              l.soon ? (
                <span
                  key={l.href}
                  aria-disabled="true"
                  title="Coming soon"
                  className="flex cursor-not-allowed items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium text-[var(--down)]"
                >
                  {l.label}
                  <span className="rounded-full bg-[var(--down-soft)] px-1.5 py-px text-[9px] font-bold uppercase tracking-wider">
                    soon
                  </span>
                </span>
              ) : (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    isActive(l.href)
                      ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {l.label}
                </Link>
              ),
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/admin"
            title="Admin panel"
            className={`hidden h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] transition-colors hover:bg-[var(--surface)] sm:flex ${
              pathname.startsWith("/admin")
                ? "text-[var(--accent)]"
                : "text-[var(--muted)]"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
          </Link>
          <WalletButton />
          <Link
            href="/portfolio"
            title="Portfolio"
            className={`hidden h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] transition-colors hover:bg-[var(--surface)] sm:flex ${
              pathname.startsWith("/portfolio")
                ? "text-[var(--accent)]"
                : "text-[var(--muted)]"
            }`}
          >
            <PieChart className="h-4 w-4" />
          </Link>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-[var(--border)] px-4 py-2 md:hidden">
          {[
            ...LINKS,
            { href: "/portfolio", label: "Portfolio" },
            { href: "/admin", label: "Admin" },
          ].map((l) =>
            l.soon ? (
              <span
                key={l.href}
                aria-disabled="true"
                title="Coming soon"
                className="flex cursor-not-allowed items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--down)]"
              >
                {l.label}
                <span className="rounded-full bg-[var(--down-soft)] px-1.5 py-px text-[9px] font-bold uppercase tracking-wider">
                  soon
                </span>
              </span>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`block rounded-xl px-3 py-2.5 text-sm font-medium ${
                  isActive(l.href)
                    ? "bg-[var(--surface-2)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {l.label}
              </Link>
            ),
          )}
        </nav>
      )}
    </header>
  );
}

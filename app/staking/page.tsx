import { Coins, Lock, TrendingUp, Sparkles } from "lucide-react";
import { TokenLogo } from "@/components/TokenLogo";
import { Eyebrow } from "@/components/ui";

export const metadata = {
  title: "Staking — IOI",
};

// Preview-only data. Staking is not functional yet (UI placeholder).
const PREVIEW_POOLS = [
  { symbol: "IOI", name: "Stake IOI", apr: "42.0%", lock: "Flexible" },
  { symbol: "ETH", name: "Liquid Staking", apr: "4.1%", lock: "Flexible" },
  { symbol: "USDC", name: "Stable Vault", apr: "8.6%", lock: "30 days" },
];

export default function StakingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Eyebrow dot="purple" className="mb-5">
        Earn · Staking
      </Eyebrow>
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
          <Coins className="h-6 w-6 text-[var(--accent)]" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Staking</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent)]">
              <Sparkles className="h-3 w-3" />
              Coming soon
            </span>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Stake tokens to earn yield and protocol rewards.
          </p>
        </div>
      </div>

      {/* Hero placeholder */}
      <div className="mt-6 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
        <div className="grid gap-8 p-8 sm:p-12 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Put your assets to work.
            </h2>
            <p className="mt-3 max-w-md text-[var(--muted)] leading-relaxed">
              Earn passive yield by staking your tokens. Choose flexible or
              locked terms, auto-compound rewards, and track your earnings in
              one place. We&apos;re putting the finishing touches on it.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                disabled
                className="cursor-not-allowed rounded-full bg-[var(--surface-2)] px-5 py-2.5 text-sm font-semibold text-[var(--muted-2)]"
              >
                Notify me (soon)
              </button>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-[var(--border)] pt-6">
              <Feature icon={<TrendingUp className="h-4 w-4" />} label="Auto-compound" />
              <Feature icon={<Lock className="h-4 w-4" />} label="Flexible locks" />
              <Feature icon={<Coins className="h-4 w-4" />} label="Multi-token" />
            </div>
          </div>

          {/* Preview pools (disabled) */}
          <div className="space-y-3">
            {PREVIEW_POOLS.map((p) => (
              <div
                key={p.symbol}
                className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <TokenLogo symbol={p.symbol} size={38} />
                  <div>
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {p.lock} · {p.symbol}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-[var(--up)]">
                      {p.apr}
                    </div>
                    <div className="text-xs text-[var(--muted)]">est. APR</div>
                  </div>
                  <button
                    disabled
                    className="cursor-not-allowed rounded-full bg-[var(--surface-2)] px-3.5 py-1.5 text-xs font-semibold text-[var(--muted-2)]"
                  >
                    Stake
                  </button>
                </div>
              </div>
            ))}
            <p className="pt-1 text-center text-xs text-[var(--muted-2)]">
              Preview only — staking is not live yet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--accent)]">
        {icon}
      </span>
      <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
    </div>
  );
}

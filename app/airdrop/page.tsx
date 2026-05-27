"use client";

import Link from "next/link";
import {
  Gift,
  Check,
  Lock,
  Globe,
  Droplets,
  ShieldCheck,
} from "lucide-react";
import { POOL_MAP, TOKEN_MAP } from "@/lib/mock-data";
import {
  useClaimedIds,
  useDexStore,
  useHydrated,
  usePositions,
} from "@/lib/store";
import { daysUntil, formatCompact, formatUsd, isPast } from "@/lib/format";
import { TokenLogo } from "@/components/TokenLogo";
import { toast } from "@/components/toast";
import { Eyebrow } from "@/components/ui";
import type { AirdropCampaign, Eligibility } from "@/lib/types";

const ELIGIBILITY_META: Record<
  Eligibility,
  { label: string; icon: React.ReactNode }
> = {
  public: { label: "Public", icon: <Globe className="h-3.5 w-3.5" /> },
  whitelist: { label: "Whitelist", icon: <Lock className="h-3.5 w-3.5" /> },
  lp: { label: "LP required", icon: <Droplets className="h-3.5 w-3.5" /> },
};

export default function AirdropPage() {
  const hydrated = useHydrated();
  const campaigns = useDexStore((s) => s.campaigns);
  const active = campaigns.filter((c) => c.active);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Eyebrow dot="yellow" className="mb-4">
        04 — Airdrops
      </Eyebrow>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
          <Gift className="h-6 w-6 text-[var(--accent)]" />
        </span>
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Airdrops</h1>
          <p className="text-sm text-[var(--muted)]">
            Claim token rewards from active campaigns.
          </p>
        </div>
      </div>

      {!hydrated ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="h-64 rounded-3xl bg-[var(--surface-2)] animate-pulse-soft" />
          <div className="h-64 rounded-3xl bg-[var(--surface-2)] animate-pulse-soft" />
        </div>
      ) : active.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-[var(--border-strong)] py-16 text-center">
          <p className="text-sm text-[var(--muted)]">
            No active campaigns right now.
          </p>
          <Link
            href="/admin"
            className="mt-2 inline-block text-sm font-medium text-[var(--accent)]"
          >
            Create one in the Admin panel →
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {active.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignCard({ campaign: c }: { campaign: AirdropCampaign }) {
  const connected = useDexStore((s) => s.connected);
  const address = useDexStore((s) => s.address);
  const connectWallet = useDexStore((s) => s.connectWallet);
  const claimAirdrop = useDexStore((s) => s.claimAirdrop);
  const claimedIds = useClaimedIds();
  const positions = usePositions();

  const token = TOKEN_MAP[c.tokenSymbol];
  const claimedAlloc = c.claimedCount * c.amountPerClaim;
  const progress = Math.min(100, (claimedAlloc / c.totalAllocation) * 100);
  const ended = isPast(c.endsAt);
  const soldOut = claimedAlloc + c.amountPerClaim > c.totalAllocation;
  const alreadyClaimed = claimedIds.includes(c.id);

  let eligible = true;
  let reason = "";
  if (c.eligibility === "whitelist") {
    eligible = !!address && c.whitelist.includes(address.toLowerCase());
    reason = "Your wallet is not whitelisted";
  } else if (c.eligibility === "lp") {
    eligible = positions.some((p) => p.poolId === c.requiredPoolId);
    const pool = c.requiredPoolId ? POOL_MAP[c.requiredPoolId] : undefined;
    reason = pool
      ? `Add liquidity to ${pool.token0}/${pool.token1} first`
      : "Liquidity position required";
  }

  const meta = ELIGIBILITY_META[c.eligibility];

  const claim = () => {
    const res = claimAirdrop(c.id);
    if (res.ok) {
      toast.success(`Claimed ${c.amountPerClaim} ${c.tokenSymbol}!`);
    } else {
      toast.error(res.error ?? "Claim failed");
    }
  };

  return (
    <div className="flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <TokenLogo symbol={c.tokenSymbol} size={44} />
          <div>
            <h3 className="font-semibold">{c.name}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
              {meta.icon}
              {meta.label}
            </span>
          </div>
        </div>
        <span className="text-xs text-[var(--muted)]">
          {ended ? "Ended" : daysUntil(c.endsAt)}
        </span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
        {c.description}
      </p>

      <div className="mt-5 flex items-end justify-between rounded-2xl bg-[var(--surface)] px-4 py-3">
        <div>
          <p className="text-xs text-[var(--muted)]">Reward per wallet</p>
          <p className="text-xl font-bold">
            {c.amountPerClaim.toLocaleString()} {c.tokenSymbol}
          </p>
        </div>
        <p className="text-sm text-[var(--muted)]">
          ≈ {formatUsd(c.amountPerClaim * (token?.priceUsd ?? 0))}
        </p>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-[var(--muted)]">
          <span>{progress.toFixed(1)}% claimed</span>
          <span>
            {formatCompact(claimedAlloc)} / {formatCompact(c.totalAllocation)}{" "}
            {c.tokenSymbol}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Eligibility hint */}
      {connected && !eligible && !alreadyClaimed && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--down-soft)] px-3 py-2 text-xs text-[var(--down)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          {reason}
        </div>
      )}

      {/* Action */}
      <div className="mt-auto pt-5">
        {!connected ? (
          <button
            onClick={() => {
              connectWallet();
              toast.success("Wallet connected (demo)");
            }}
            className="h-12 w-full rounded-2xl bg-[var(--accent)] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            Connect to claim
          </button>
        ) : alreadyClaimed ? (
          <button
            disabled
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--up-soft)] font-semibold text-[var(--up)]"
          >
            <Check className="h-5 w-5" />
            Claimed
          </button>
        ) : (
          <button
            disabled={!eligible || ended || soldOut}
            onClick={claim}
            className="h-12 w-full rounded-2xl bg-[var(--accent)] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--muted-2)]"
          >
            {ended
              ? "Ended"
              : soldOut
                ? "Fully claimed"
                : !eligible
                  ? "Not eligible"
                  : "Claim"}
          </button>
        )}
      </div>
    </div>
  );
}

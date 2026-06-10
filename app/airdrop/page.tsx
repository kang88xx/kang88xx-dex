"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppKit } from "@reown/appkit/react";
import { Gift, Check, Lock, Globe, ShieldCheck, Loader2 } from "lucide-react";
import { parseUnits } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { TOKEN_MAP } from "@/lib/mock-data";
import { useDexStore, useHydrated } from "@/lib/store";
import { useCampaigns } from "@/lib/campaigns";
import { daysUntil, formatCompact, formatUsd, isPast } from "@/lib/format";
import { merkleProof } from "@/lib/merkle";
import { AIRDROP_ABI, AIRDROP_CONTRACT, airdropLive, CHAIN_ID } from "@/lib/airdrop";
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
};

export default function AirdropPage() {
  const hydrated = useHydrated();
  const { data: campaigns = [], isLoading } = useCampaigns();
  const active = campaigns.filter((c) => c.active);
  const loading = !hydrated || isLoading;

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

      {loading ? (
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
  const { open: openWalletModal } = useAppKit();
  const { address: wallet, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [claiming, setClaiming] = useState(false);

  // On-chain claim is live once the campaign was launched (has an onchainId)
  // and a contract address is configured.
  const isOnchain = airdropLive && c.onchainId != null;

  // Real claimed state comes from the contract (shared across all browsers).
  const { data: claimedOnchain, refetch: refetchClaimed } = useReadContract({
    address: AIRDROP_CONTRACT as `0x${string}`,
    abi: AIRDROP_ABI,
    functionName: "hasClaimed",
    args: c.onchainId != null && wallet ? [BigInt(c.onchainId), wallet] : undefined,
    query: { enabled: isOnchain && !!wallet },
  });

  const token = TOKEN_MAP[c.tokenSymbol];
  // Whitelist wallets carry their own allocation; everyone else uses the default.
  const wlEntry =
    c.eligibility === "whitelist" && address
      ? c.whitelist.find((w) => w.address === address.toLowerCase())
      : undefined;
  const claimAmount = wlEntry?.amount ?? c.amountPerClaim;
  const claimedAlloc = c.claimedCount * c.amountPerClaim;
  const progress = Math.min(100, (claimedAlloc / c.totalAllocation) * 100);
  const ended = isPast(c.endsAt);
  const soldOut = claimedAlloc + c.amountPerClaim > c.totalAllocation;
  // On-chain truth when launched; else the admin "received" mark.
  const alreadyClaimed = isOnchain ? !!claimedOnchain : !!wlEntry?.claimed;

  let eligible = true;
  let reason = "";
  if (c.eligibility === "whitelist") {
    eligible = !!wlEntry;
    reason = "Your wallet is not whitelisted";
  }

  const doClaim = async () => {
    if (!isOnchain || c.onchainId == null || !wallet || !publicClient) return;
    if (chainId !== CHAIN_ID)
      return toast.error("지갑 네트워크를 BSC로 전환하세요");
    const tok = TOKEN_MAP[c.tokenSymbol];
    if (!tok) return;
    // Rebuild the exact allocation set used at launch to regenerate the proof.
    const allocs = c.whitelist.map((w) => ({
      address: w.address,
      amountWei: parseUnits(String(w.amount), tok.decimals).toString(),
    }));
    const pf = merkleProof(allocs, wallet);
    if (!pf) return toast.error("이 지갑은 화이트리스트에 없습니다");
    try {
      setClaiming(true);
      toast.info("클레임 트랜잭션을 지갑에서 승인하세요");
      const hash = await writeContractAsync({
        address: AIRDROP_CONTRACT as `0x${string}`,
        abi: AIRDROP_ABI,
        functionName: "claim",
        args: [BigInt(c.onchainId), BigInt(pf.amountWei), pf.proof],
        chainId: CHAIN_ID,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") return toast.error("클레임 실패");
      refetchClaimed();
      toast.success(
        `${claimAmount.toLocaleString()} ${c.tokenSymbol} 클레임 완료!`,
      );
    } catch {
      toast.error("클레임 실패 — 이미 수령했거나 지갑에서 거부됨");
    } finally {
      setClaiming(false);
    }
  };

  // Fallback guards against any legacy persisted campaign (e.g. the removed
  // "lp" eligibility) so an unknown value can't crash the card.
  const meta = ELIGIBILITY_META[c.eligibility] ?? ELIGIBILITY_META.public;

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
          <p className="text-xs text-[var(--muted)]">
            {wlEntry ? "Your allocation" : "Reward per wallet"}
          </p>
          <p className="text-xl font-bold">
            {claimAmount.toLocaleString()} {c.tokenSymbol}
          </p>
        </div>
        <p className="text-sm text-[var(--muted)]">
          ≈ {formatUsd(claimAmount * (token?.priceUsd ?? 0))}
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
            onClick={() => openWalletModal()}
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
        ) : eligible && !ended && !soldOut && isOnchain ? (
          <button
            onClick={doClaim}
            disabled={claiming}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {claiming && <Loader2 className="h-5 w-5 animate-spin" />}
            {claiming
              ? "Claiming…"
              : `Claim ${claimAmount.toLocaleString()} ${c.tokenSymbol}`}
          </button>
        ) : (
          <button
            disabled
            className="h-12 w-full rounded-2xl bg-[var(--accent)] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--muted-2)]"
          >
            {ended
              ? "Ended"
              : soldOut
                ? "Fully claimed"
                : !eligible
                  ? "Not eligible"
                  : "On-chain claims coming soon"}
          </button>
        )}
      </div>
    </div>
  );
}

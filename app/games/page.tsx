"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Coins, Trophy, Clock, Flame, Users, TrendingUp, Loader2 } from "lucide-react";
import { useAppKit } from "@reown/appkit/react";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDexStore, useHydrated, LMS_CONFIG } from "@/lib/store";
import { useBalance } from "@/lib/balances";
import { formatNumber, shortAddress, timeAgoPure } from "@/lib/format";
import { Eyebrow } from "@/components/ui";
import { TokenLogo } from "@/components/TokenLogo";
import { toast } from "@/components/toast";
import { TOKEN_MAP } from "@/lib/tokens";
import { CHAIN_ID, CHAIN_LABEL, IS_TESTNET } from "@/lib/chain";
import { LMS_ABI, LMS_CONTRACT, lmsLive } from "@/lib/lms";

// KANG meme-coin contract on the active network — the token used for game bets.
const KANG_ADDRESS = TOKEN_MAP.KANG?.address ?? "not deployed on this network";

// Game fee destinations (display only until on-chain payouts ship).
const FEE_WALLETS = {
  treasury: "0x44414D1Ff9e4aFC08503CEDBb43Ab6ef201acb91",
  burn: "0x2c151C3FD184045396D4339426a77E367A684Af1",
};
const EXPLORER = IS_TESTNET
  ? "https://testnet.bscscan.com"
  : "https://bscscan.com";

// Meme-coin bet sizes (KANG trades for fractions of a cent).
const QUICK_CHIPS = [100, 500, 1000, 5000];

function mmss(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function GamesPage() {
  // lmsLive is a build-time env constant — same on server and client.
  return lmsLive ? <OnchainGame /> : <DemoGame />;
}

/** The local demo (phantom bots, store rounds) — shown until KangLMS is deployed. */
function DemoGame() {
  const hydrated = useHydrated();
  const connected = useDexStore((s) => s.connected);
  const address = useDexStore((s) => s.address);
  const { open: openWalletModal } = useAppKit();
  const round = useDexStore((s) => s.lms.round);
  const history = useDexStore((s) => s.lms.history);
  const pendingClaims = useDexStore((s) => s.lms.pendingClaims);
  const lmsEnsureRound = useDexStore((s) => s.lmsEnsureRound);
  const lmsCheckExpiry = useDexStore((s) => s.lmsCheckExpiry);
  const lmsBotTick = useDexStore((s) => s.lmsBotTick);
  const kang = useBalance("KANG");

  const [amount, setAmount] = useState("100");
  // nowMs drives both the countdown display and timeAgoPure calls — pure render
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [srAnnounce, setSrAnnounce] = useState<{ id: number; message: string } | null>(null);

  const botTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const announcedExpiryRef = useRef(false);
  const prevClaimCountRef = useRef(0);
  const prevRoundIdRef = useRef<string | null>(null);
  const prevRemainingRef = useRef<number>(Infinity);

  // On mount: ensure a round exists, handle stale persisted rounds
  useEffect(() => {
    lmsEnsureRound();
  }, [lmsEnsureRound]);

  // 1-second ticker — updates nowMs, which drives remainingMs and timeAgoPure in render
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      lmsCheckExpiry();
      setNowMs(Date.now());
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [lmsCheckExpiry]);

  // Bot tick every ~10s
  useEffect(() => {
    botTickRef.current = setInterval(() => {
      lmsBotTick();
    }, LMS_CONFIG.BOT_TICK_MS);
    return () => {
      if (botTickRef.current) clearInterval(botTickRef.current);
    };
  }, [lmsBotTick]);

  const parsedAmt = parseFloat(amount);
  const betAmt = Number.isFinite(parsedAmt) ? parsedAmt : 0;
  const isActive = round.status === "active";
  const overBalance = hydrated && connected && betAmt > kang;

  // Pure derivations — no Date.now() in render
  const remainingMs = Math.max(0, round.endsAt - nowMs);

  // Memoized unique player count keyed on bets array reference
  const uniquePlayers = useMemo(
    () => new Set(round.bets.map((b) => b.address)).size,
    [round.bets],
  );

  const previewPrize =
    betAmt > 0 ? round.prizePool + betAmt * LMS_CONFIG.FEE_PRIZE : 0;

  // Pending claims for this address
  const myClaims = useMemo(
    () =>
      address
        ? (pendingClaims ?? []).filter((c) => c.address === address)
        : [],
    [pendingClaims, address],
  );

  // Sparse screen-reader announcements — fires as side-effects of state changes
  useEffect(() => {
    // Reset expiry announcement flag and prevRemainingRef when round changes
    if (prevRoundIdRef.current !== round.id) {
      prevRoundIdRef.current = round.id;
      announcedExpiryRef.current = false;
      prevRemainingRef.current = Infinity;
      setSrAnnounce({ id: Date.now(), message: "New round started" });
    }
  }, [round.id]);

  useEffect(() => {
    if (
      prevRemainingRef.current >= 10_000 &&
      remainingMs < 10_000 &&
      remainingMs > 0 &&
      !announcedExpiryRef.current
    ) {
      setSrAnnounce({ id: Date.now(), message: "Round about to expire" });
      announcedExpiryRef.current = true;
    }
    prevRemainingRef.current = remainingMs;
  }, [remainingMs]);

  useEffect(() => {
    const currentCount = myClaims.length;
    if (currentCount > prevClaimCountRef.current) {
      setSrAnnounce({ id: Date.now(), message: "You won the round. Claim available." });
    }
    prevClaimCountRef.current = currentCount;
  }, [myClaims.length]);

  const maxBet = () =>
    setAmount(kang > 0 ? String(Math.floor(kang)) : "0");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Eyebrow dot="yellow" className="mb-5">
        Play · Last Man Standing
      </Eyebrow>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
            <Coins className="h-6 w-6 text-[var(--accent)]" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Last Man Standing
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--muted)]">
                Demo rounds · on-chain soon
              </span>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Place a bet. Reset the timer. Last bettor wins the pool.
            </p>
          </div>
        </div>

        <div
          title={`${CHAIN_LABEL} KANG · ${KANG_ADDRESS}`}
          className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs sm:flex"
        >
          <TokenLogo symbol="KANG" size={18} />
          <span className="font-semibold">KANG</span>
          <span className="text-[var(--muted)]">·</span>
          <span className="font-mono text-[var(--muted)]">BSC</span>
        </div>
      </div>

      {/* Hero countdown card */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-10 shadow-2xl mb-5 flex flex-col items-center text-center">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
          Time Remaining
        </span>

        <div
          className="font-mono text-7xl sm:text-8xl font-bold tabular-nums leading-none mb-4 transition-transform"
          style={{
            color: remainingMs < 10_000 ? "var(--down)" : "var(--foreground)",
          }}
        >
          {mmss(remainingMs)}
        </div>

        {/* Sparse screen-reader announcer — only fires on meaningful events */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {srAnnounce?.message}
        </div>

        {/* Last bettor */}
        <div className="text-sm text-[var(--muted)]">
          {round.lastBettor ? (
            <>
              Last bettor:{" "}
              <span className="font-mono font-semibold text-[var(--foreground)]">
                {shortAddress(round.lastBettor)}
                {round.lastBettor === address && (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                    YOU
                  </span>
                )}
              </span>
            </>
          ) : (
            <span>No bets yet</span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Prize Pool"
          value={`${formatNumber(round.prizePool, 2)} KANG`}
          detail="80% of bets"
          accent
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Players"
          value={String(uniquePlayers)}
          detail="this round"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Total Bets"
          value={String(round.bets.length)}
          detail="this round"
        />
        <StatCard
          icon={<Flame className="h-4 w-4" />}
          label="Burned"
          value={`${formatNumber(round.burnedPool, 2)} KANG`}
          detail="5% of bets"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_340px]">
        {/* Left column: claims card + bet card + fee bar */}
        <div className="flex flex-col gap-5">
          {/* Your Claims card — only rendered when there are pending claims */}
          {myClaims.length > 0 && (
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-4 w-4 text-[var(--up)]" />
                <h2 className="text-base font-semibold">Your Claims</h2>
              </div>
              <div className="space-y-2">
                {myClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="flex items-center justify-between rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs text-[var(--muted-2)]">
                        Round #{claim.roundId.slice(-4)}
                      </span>
                      <span className="font-semibold">
                        {claim.amount.toFixed(2)} KANG
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--muted)]">
                        {timeAgoPure(claim.createdAt, nowMs)}
                      </span>
                      <button
                        disabled
                        title="On-chain payouts coming soon"
                        aria-label={`Claim ${claim.amount.toFixed(2)} KANG from round ${claim.roundId.slice(-4)} — on-chain payouts coming soon`}
                        className="cursor-not-allowed rounded-xl bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-2)]"
                      >
                        Claim
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Place Your Bet card */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7 shadow-2xl">
            <h2 className="text-base font-semibold mb-4">Place Your Bet</h2>

            {/* Amount input */}
            <div className="rounded-2xl bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                <label htmlFor="lms-bet-amount">Bet amount</label>
                <span>
                  Balance:{" "}
                  <span
                    className={
                      overBalance ? "font-semibold text-[var(--down)]" : ""
                    }
                  >
                    {hydrated && connected ? formatNumber(kang, 2) : "—"} KANG
                  </span>
                </span>
              </div>
              <div className="mt-1 flex items-center">
                <input
                  id="lms-bet-amount"
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={LMS_CONFIG.MIN_BET}
                  placeholder="0"
                  className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-[var(--muted-2)]"
                />
                <span className="text-sm font-semibold text-[var(--muted)]">
                  KANG
                </span>
              </div>
              <div className="mt-2 flex gap-2 flex-wrap">
                {QUICK_CHIPS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(String(v))}
                    className="rounded-lg bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {v}
                  </button>
                ))}
                <button
                  disabled={!hydrated || !connected}
                  onClick={maxBet}
                  className="rounded-lg bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Payout preview */}
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-sm">
              <span className="text-[var(--muted)]">
                Payout if you hold the last bet
              </span>
              <span className="font-semibold">
                {betAmt > 0
                  ? `${formatNumber(previewPrize, 2)} KANG`
                  : "—"}
              </span>
            </div>

            {/* Action button */}
            <div className="mt-5">
              {!hydrated ? (
                <div className="h-12 w-full rounded-2xl bg-[var(--surface-2)] animate-pulse-soft" />
              ) : !connected ? (
                <button
                  onClick={() => openWalletModal()}
                  className="h-12 w-full rounded-2xl bg-[var(--accent)] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
                >
                  Connect Wallet
                </button>
              ) : (
                <button
                  disabled
                  className="h-12 w-full rounded-2xl bg-[var(--accent)] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--muted-2)]"
                >
                  {!isActive
                    ? "Round ended"
                    : overBalance
                      ? "Insufficient KANG"
                      : betAmt < LMS_CONFIG.MIN_BET
                        ? `Minimum ${LMS_CONFIG.MIN_BET} KANG`
                        : "On-chain game coming soon"}
                </button>
              )}
            </div>

            <p className="mt-3 text-center text-[11px] text-[var(--muted-2)]">
              No randomness · last bettor wins the pool · on-chain version
              coming soon
            </p>
          </div>

          {/* Fee distribution bar */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="text-sm font-semibold mb-3">Fee Distribution</h3>
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              <div
                className="h-full"
                style={{ width: "80%", backgroundColor: "var(--accent)" }}
                title="80% Prize Pool"
              />
              <div
                className="h-full"
                style={{ width: "15%", backgroundColor: "var(--up)" }}
                title="15% Treasury"
              />
              <div
                className="h-full"
                style={{ width: "5%", backgroundColor: "var(--down)" }}
                title="5% Burn"
              />
            </div>
            <div className="mt-3 flex flex-col gap-2 text-xs text-[var(--muted)]">
              <LegendRow color="var(--accent)" label="Prize" pct="80%" />
              <LegendRow
                color="var(--up)"
                label="Treasury"
                pct="15%"
                address={FEE_WALLETS.treasury}
              />
              <LegendRow
                color="var(--down)"
                label="Burn"
                pct="5%"
                address={FEE_WALLETS.burn}
              />
            </div>
          </div>
        </div>

        {/* Right column: recent bets + round history */}
        <div className="flex flex-col gap-5">
          {/* Recent Bets */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Recent Bets</h3>
              <span className="text-xs text-[var(--muted-2)]">
                {Math.min(round.bets.length, 12)} shown
              </span>
            </div>
            {round.bets.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted-2)]">
                No bets yet — be the first.
              </p>
            ) : (
              <div className="space-y-1.5">
                {/* Header */}
                <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-2 pb-1 text-[10px] uppercase tracking-widest text-[var(--muted-2)]">
                  <span>Time</span>
                  <span>Address</span>
                  <span>Amount</span>
                  <span>Rd</span>
                </div>
                {round.bets.slice(0, 12).map((bet) => (
                  <div
                    key={bet.id}
                    className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center rounded-xl px-2 py-1.5 text-xs transition-colors"
                  >
                    <span className="text-[var(--muted)]">
                      {timeAgoPure(bet.timestamp, nowMs)}
                    </span>
                    <span className="font-mono">
                      {shortAddress(bet.address)}
                      {bet.address === address && (
                        <span className="ml-1 inline-flex items-center rounded-full bg-[var(--accent-soft)] px-1.5 py-px text-[9px] font-bold text-[var(--accent)]">
                          YOU
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-right">
                      {formatNumber(bet.amount, 2)}
                    </span>
                    <span className="text-[var(--muted-2)] text-right font-mono text-[10px]">
                      #{round.id.slice(-4)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Round History */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="text-sm font-semibold mb-3">Round History</h3>
            {history.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted-2)]">
                First round in progress.
              </p>
            ) : (
              <div className="space-y-1.5">
                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-2 pb-1 text-[10px] uppercase tracking-widest text-[var(--muted-2)]">
                  <span>Round</span>
                  <span>Winner</span>
                  <span>Prize</span>
                  <span>Ended</span>
                </div>
                {history.slice(0, 5).map((h) => (
                  <div
                    key={h.roundId}
                    className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center rounded-xl px-2 py-1.5 text-xs"
                  >
                    <span className="font-mono text-[var(--muted-2)] text-[10px]">
                      #{h.roundId.slice(-4)}
                    </span>
                    <span className="font-mono truncate flex items-center gap-1">
                      {h.winner ? shortAddress(h.winner) : "—"}
                      {h.isBot && (
                        <span className="inline-flex items-center rounded-full bg-[var(--surface-2)] px-1.5 py-px text-[9px] font-bold text-[var(--muted)]">
                          BOT
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-right">
                      {formatNumber(h.prize, 2)}
                    </span>
                    <span className="text-[var(--muted)] text-right">
                      {timeAgoPure(h.endedAt, nowMs)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── On-chain game (KangLMS) ──────────────────────────────────────────────────

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/**
 * The real game — round state, bets, prizes all live on the KangLMS contract.
 * Anyone can settle an expired round (pull-payment prizes, no keeper needed).
 */
function OnchainGame() {
  const hydrated = useHydrated();
  const connected = useDexStore((s) => s.connected);
  const { open: openWalletModal } = useAppKit();
  const { address: wallet, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const kang = useBalance("KANG");

  const [amount, setAmount] = useState("100");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState<"bet" | "claim" | null>(null);

  const contract = LMS_CONTRACT as `0x${string}`;
  const dec = TOKEN_MAP.KANG?.decimals ?? 18;
  const kangAddr = TOKEN_MAP.KANG?.address as `0x${string}` | undefined;

  // Live round (id, prizePool, totalBurned, deadline, lastBettor, betCount,
  // uniquePlayers, settled) — one read, 5s refresh.
  const { data: roundData } = useReadContract({
    address: contract,
    abi: LMS_ABI,
    functionName: "currentRound",
    chainId: CHAIN_ID,
    query: { refetchInterval: 5_000 },
  });
  const { data: pendingWei } = useReadContract({
    address: contract,
    abi: LMS_ABI,
    functionName: "pendingPrize",
    args: wallet ? [wallet] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!wallet, refetchInterval: 10_000 },
  });
  const { data: minBetWei } = useReadContract({
    address: contract,
    abi: LMS_ABI,
    functionName: "minBet",
    chainId: CHAIN_ID,
    query: { refetchInterval: 60_000 },
  });
  const { data: isPaused } = useReadContract({
    address: contract,
    abi: LMS_ABI,
    functionName: "paused",
    chainId: CHAIN_ID,
    query: { refetchInterval: 30_000 },
  });

  // 1-second ticker drives the countdown.
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const round = roundData
    ? {
        id: Number(roundData[0]),
        prizePoolWei: roundData[1],
        burnedWei: roundData[2],
        deadlineMs: Number(roundData[3]) * 1000,
        lastBettor: roundData[4] as string,
        betCount: Number(roundData[5]),
        uniquePlayers: Number(roundData[6]),
        settled: roundData[7],
      }
    : null;

  const prizePool = round ? Number(formatUnits(round.prizePoolWei, dec)) : 0;
  const burned = round ? Number(formatUnits(round.burnedWei, dec)) : 0;
  const minBet = minBetWei != null ? Number(formatUnits(minBetWei, dec)) : 1;
  const pending = pendingWei != null ? Number(formatUnits(pendingWei, dec)) : 0;

  // deadline == 0 → the round is waiting for its first bet (lazy start).
  const waiting = round != null && round.deadlineMs === 0;
  const remainingMs =
    round && !waiting ? Math.max(0, round.deadlineMs - nowMs) : 0;
  const expired =
    round != null && !waiting && remainingMs <= 0 && !round.settled;
  const lastBettor =
    round && round.lastBettor !== ZERO_ADDR ? round.lastBettor : null;
  // A just-ended pot isn't credited until settlement, but claim() settles
  // automatically on-chain — so show it to the winner as claimable right away.
  const unsettledWin =
    expired &&
    wallet &&
    lastBettor &&
    lastBettor.toLowerCase() === wallet.toLowerCase()
      ? prizePool
      : 0;
  const claimable = pending + unsettledWin;

  // Recent bets + round history straight from contract events.
  const { data: recentBets } = useQuery({
    queryKey: ["lms-recent-bets", contract, round?.id],
    enabled: !!publicClient && round != null,
    refetchInterval: 10_000,
    queryFn: async () => {
      const logs = await publicClient!.getContractEvents({
        address: contract,
        abi: LMS_ABI,
        eventName: "BetPlaced",
        args: { roundId: BigInt(round!.id) },
        fromBlock: "earliest",
        toBlock: "latest",
      });
      return logs
        .slice(-12)
        .reverse()
        .map((log) => ({
          key: `${log.transactionHash}-${log.logIndex}`,
          bettor: (log.args.bettor ?? ZERO_ADDR) as string,
          amount: Number(formatUnits(log.args.amount ?? 0n, dec)),
          block: Number(log.blockNumber ?? 0n),
        }));
    },
  });

  const { data: history } = useQuery({
    queryKey: ["lms-history", contract, round?.id],
    enabled: !!publicClient && round != null,
    refetchInterval: 30_000,
    queryFn: async () => {
      const logs = await publicClient!.getContractEvents({
        address: contract,
        abi: LMS_ABI,
        eventName: "RoundSettled",
        fromBlock: "earliest",
        toBlock: "latest",
      });
      return logs
        .slice(-5)
        .reverse()
        .map((log) => ({
          roundId: Number(log.args.id ?? 0n),
          winner: (log.args.winner ?? ZERO_ADDR) as string,
          prize: Number(formatUnits(log.args.prize ?? 0n, dec)),
          block: Number(log.blockNumber ?? 0n),
        }));
    },
  });

  const refreshAll = () => queryClient.invalidateQueries();

  const requireWallet = (): boolean => {
    if (!wallet || !publicClient) {
      toast.error("지갑을 연결하세요");
      return false;
    }
    if (chainId !== CHAIN_ID) {
      toast.error("지갑 네트워크를 BSC로 전환하세요");
      return false;
    }
    return true;
  };

  const parsedAmt = parseFloat(amount);
  const betAmt = Number.isFinite(parsedAmt) ? parsedAmt : 0;
  const overBalance = hydrated && connected && betAmt > kang;
  // An expired pot goes to its winner — a bet now opens a FRESH round.
  const previewPrize =
    betAmt > 0 ? (expired ? 0 : prizePool) + betAmt * LMS_CONFIG.FEE_PRIZE : 0;

  const doBet = async () => {
    if (!requireWallet() || !round || !kangAddr) return;
    const amountWei = parseUnits(String(betAmt), dec);
    try {
      setBusy("bet");
      const allowance = await publicClient!.readContract({
        address: kangAddr,
        abi: erc20Abi,
        functionName: "allowance",
        args: [wallet!, contract],
      });
      if (allowance < amountWei) {
        toast.info("1/2 KANG 사용 승인 중… 지갑에서 확인하세요");
        const approveHash = await writeContractAsync({
          address: kangAddr,
          abi: erc20Abi,
          functionName: "approve",
          args: [contract, amountWei],
          chainId: CHAIN_ID,
        });
        await publicClient!.waitForTransactionReceipt({ hash: approveHash });
      }
      toast.info("베팅 트랜잭션을 지갑에서 승인하세요");
      const hash = await writeContractAsync({
        address: contract,
        abi: LMS_ABI,
        functionName: "bet",
        args: [amountWei],
        chainId: CHAIN_ID,
      });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") return toast.error("베팅 실패");
      toast.success(
        `${betAmt.toLocaleString()} KANG 베팅 완료 — 타이머가 연장되었습니다`,
      );
      refreshAll();
    } catch {
      toast.error("베팅 실패 — 라운드 만료 / 잔액 / 지갑 거부를 확인하세요");
    } finally {
      setBusy(null);
    }
  };

  const doClaim = async () => {
    if (!requireWallet()) return;
    try {
      setBusy("claim");
      toast.info("상금 수령 트랜잭션을 지갑에서 승인하세요");
      const hash = await writeContractAsync({
        address: contract,
        abi: LMS_ABI,
        functionName: "claim",
        chainId: CHAIN_ID,
      });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") return toast.error("수령 실패");
      toast.success(`${claimable.toLocaleString()} KANG 수령 완료!`);
      refreshAll();
    } catch {
      toast.error("수령 실패 — 지갑에서 거부되었거나 수령할 금액이 없습니다");
    } finally {
      setBusy(null);
    }
  };

  const maxBet = () => setAmount(kang > 0 ? String(Math.floor(kang)) : "0");

  // Betting on an expired round is fine — bet() settles it and opens the next.
  const canBet =
    round != null && !isPaused && !overBalance && betAmt >= minBet;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Eyebrow dot="yellow" className="mb-5">
        Play · Last Man Standing
      </Eyebrow>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
            <Coins className="h-6 w-6 text-[var(--accent)]" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Last Man Standing
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--up)]/40 bg-[var(--up-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--up)]">
                On-chain · {round ? `Round #${round.id + 1}` : "…"}
              </span>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Place a bet. Reset the timer. Last bettor wins the pool.
            </p>
          </div>
        </div>

        <div
          title={`${CHAIN_LABEL} KANG · ${KANG_ADDRESS}`}
          className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs sm:flex"
        >
          <TokenLogo symbol="KANG" size={18} />
          <span className="font-semibold">KANG</span>
          <span className="text-[var(--muted)]">·</span>
          <span className="font-mono text-[var(--muted)]">BSC</span>
        </div>
      </div>

      {/* Hero countdown card */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-10 shadow-2xl mb-5 flex flex-col items-center text-center">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
          {waiting
            ? "Waiting for first bet"
            : expired
              ? "Round ended"
              : "Time Remaining"}
        </span>

        <div
          className="font-mono text-7xl sm:text-8xl font-bold tabular-nums leading-none mb-4"
          style={{
            color: waiting
              ? "var(--muted-2)"
              : remainingMs < 10_000
                ? "var(--down)"
                : "var(--foreground)",
          }}
        >
          {waiting ? "--:--" : mmss(remainingMs)}
        </div>

        {waiting && (
          <p className="mb-3 text-xs text-[var(--muted)]">
            첫 베팅이 들어오면 타이머가 시작됩니다
          </p>
        )}

        {/* Expired round → bet()/claim() settle it automatically on-chain. */}
        {expired && (
          <p className="mb-3 text-xs text-[var(--muted)]">
            {lastBettor
              ? "승자는 아래에서 바로 클레임할 수 있고, 다음 베팅이 자동으로 새 라운드를 시작합니다"
              : "다음 베팅이 자동으로 새 라운드를 시작합니다"}
          </p>
        )}

        {/* Last bettor */}
        <div className="text-sm text-[var(--muted)]">
          {lastBettor ? (
            <>
              {expired ? "Winner:" : "Last bettor:"}{" "}
              <span className="font-mono font-semibold text-[var(--foreground)]">
                {shortAddress(lastBettor)}
                {wallet && lastBettor.toLowerCase() === wallet.toLowerCase() && (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                    YOU
                  </span>
                )}
              </span>
            </>
          ) : (
            <span>No bets yet</span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Prize Pool"
          value={`${formatNumber(prizePool, 2)} KANG`}
          detail="80% of bets"
          accent
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Players"
          value={round ? String(round.uniquePlayers) : "—"}
          detail="this round"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Total Bets"
          value={round ? String(round.betCount) : "—"}
          detail="this round"
        />
        <StatCard
          icon={<Flame className="h-4 w-4" />}
          label="Burned"
          value={`${formatNumber(burned, 2)} KANG`}
          detail="5% of bets"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_340px]">
        {/* Left column: claims card + bet card + fee bar */}
        <div className="flex flex-col gap-5">
          {/* Pull-payment prize claim — includes a just-won pot (claim() settles it) */}
          {hydrated && connected && claimable > 0 && (
            <div className="rounded-3xl border border-[var(--up)]/40 bg-[var(--card)] p-5 sm:p-7 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-4 w-4 text-[var(--up)]" />
                <h2 className="text-base font-semibold">Your Prize</h2>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[var(--surface)] px-4 py-3">
                <span className="text-xl font-bold">
                  {formatNumber(claimable, 2)} KANG
                </span>
                <button
                  onClick={doClaim}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--up)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy === "claim" && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {busy === "claim" ? "수령 중…" : "Claim"}
                </button>
              </div>
            </div>
          )}

          {/* Place Your Bet card */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7 shadow-2xl">
            <h2 className="text-base font-semibold mb-4">Place Your Bet</h2>

            <div className="rounded-2xl bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                <label htmlFor="lms-bet-amount">Bet amount</label>
                <span>
                  Balance:{" "}
                  <span
                    className={
                      overBalance ? "font-semibold text-[var(--down)]" : ""
                    }
                  >
                    {hydrated && connected ? formatNumber(kang, 2) : "—"} KANG
                  </span>
                </span>
              </div>
              <div className="mt-1 flex items-center">
                <input
                  id="lms-bet-amount"
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={minBet}
                  placeholder="0"
                  className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-[var(--muted-2)]"
                />
                <span className="text-sm font-semibold text-[var(--muted)]">
                  KANG
                </span>
              </div>
              <div className="mt-2 flex gap-2 flex-wrap">
                {QUICK_CHIPS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(String(v))}
                    className="rounded-lg bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {v}
                  </button>
                ))}
                <button
                  disabled={!hydrated || !connected}
                  onClick={maxBet}
                  className="rounded-lg bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Payout preview */}
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-sm">
              <span className="text-[var(--muted)]">
                Payout if you hold the last bet
              </span>
              <span className="font-semibold">
                {betAmt > 0 ? `${formatNumber(previewPrize, 2)} KANG` : "—"}
              </span>
            </div>

            {/* Action button */}
            <div className="mt-5">
              {!hydrated ? (
                <div className="h-12 w-full rounded-2xl bg-[var(--surface-2)] animate-pulse-soft" />
              ) : !connected ? (
                <button
                  onClick={() => openWalletModal()}
                  className="h-12 w-full rounded-2xl bg-[var(--accent)] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
                >
                  Connect Wallet
                </button>
              ) : (
                <button
                  onClick={doBet}
                  disabled={!canBet || busy !== null}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--muted-2)]"
                >
                  {busy === "bet" && <Loader2 className="h-5 w-5 animate-spin" />}
                  {busy === "bet"
                    ? "베팅 중…"
                    : !round
                      ? "라운드 불러오는 중…"
                      : isPaused
                        ? "게임 일시정지됨"
                        : overBalance
                          ? "Insufficient KANG"
                          : betAmt < minBet
                            ? `Minimum ${minBet.toLocaleString()} KANG`
                            : expired
                              ? `Bet ${betAmt.toLocaleString()} KANG — 새 라운드 시작`
                              : `Bet ${betAmt.toLocaleString()} KANG`}
                </button>
              )}
            </div>

            <p className="mt-3 text-center text-[11px] text-[var(--muted-2)]">
              No randomness · last bettor wins the pool · prizes are claimed
              from the contract (pull-payment)
            </p>
          </div>

          {/* Fee distribution bar */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="text-sm font-semibold mb-3">Fee Distribution</h3>
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              <div
                className="h-full"
                style={{ width: "80%", backgroundColor: "var(--accent)" }}
                title="80% Prize Pool"
              />
              <div
                className="h-full"
                style={{ width: "15%", backgroundColor: "var(--up)" }}
                title="15% Treasury"
              />
              <div
                className="h-full"
                style={{ width: "5%", backgroundColor: "var(--down)" }}
                title="5% Burn"
              />
            </div>
            <div className="mt-3 flex flex-col gap-2 text-xs text-[var(--muted)]">
              <LegendRow color="var(--accent)" label="Prize" pct="80%" />
              <LegendRow
                color="var(--up)"
                label="Treasury"
                pct="15%"
                address={FEE_WALLETS.treasury}
              />
              <LegendRow
                color="var(--down)"
                label="Burn"
                pct="5%"
                address={FEE_WALLETS.burn}
              />
            </div>
          </div>
        </div>

        {/* Right column: recent bets + round history */}
        <div className="flex flex-col gap-5">
          {/* Recent Bets */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Recent Bets</h3>
              <span className="text-xs text-[var(--muted-2)]">
                {recentBets?.length ?? 0} shown
              </span>
            </div>
            {!recentBets || recentBets.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted-2)]">
                No bets yet — be the first.
              </p>
            ) : (
              <div className="space-y-1.5">
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 pb-1 text-[10px] uppercase tracking-widest text-[var(--muted-2)]">
                  <span>Address</span>
                  <span>Amount</span>
                  <span>Block</span>
                </div>
                {recentBets.map((bet) => (
                  <div
                    key={bet.key}
                    className="grid grid-cols-[1fr_auto_auto] gap-2 items-center rounded-xl px-2 py-1.5 text-xs"
                  >
                    <span className="font-mono">
                      {shortAddress(bet.bettor)}
                      {wallet &&
                        bet.bettor.toLowerCase() === wallet.toLowerCase() && (
                          <span className="ml-1 inline-flex items-center rounded-full bg-[var(--accent-soft)] px-1.5 py-px text-[9px] font-bold text-[var(--accent)]">
                            YOU
                          </span>
                        )}
                    </span>
                    <span className="font-semibold text-right">
                      {formatNumber(bet.amount, 2)}
                    </span>
                    <span className="text-[var(--muted-2)] text-right font-mono text-[10px]">
                      {bet.block}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Round History */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="text-sm font-semibold mb-3">Round History</h3>
            {!history || history.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted-2)]">
                First round in progress.
              </p>
            ) : (
              <div className="space-y-1.5">
                <div className="grid grid-cols-[auto_1fr_auto] gap-2 px-2 pb-1 text-[10px] uppercase tracking-widest text-[var(--muted-2)]">
                  <span>Round</span>
                  <span>Winner</span>
                  <span>Prize</span>
                </div>
                {history.map((h) => (
                  <div
                    key={h.roundId}
                    className="grid grid-cols-[auto_1fr_auto] gap-2 items-center rounded-xl px-2 py-1.5 text-xs"
                  >
                    <span className="font-mono text-[var(--muted-2)] text-[10px]">
                      #{h.roundId + 1}
                    </span>
                    <span className="font-mono truncate">
                      {h.winner !== ZERO_ADDR ? shortAddress(h.winner) : "환불"}
                    </span>
                    <span className="font-semibold text-right">
                      {formatNumber(h.prize, 2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LegendRow({
  color,
  label,
  pct,
  address,
}: {
  color: string;
  label: string;
  pct: string;
  address?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        {label} {pct}
      </span>
      {address && (
        <a
          href={`${EXPLORER}/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          title={address}
          className="font-mono text-[var(--muted-2)] transition-colors hover:text-[var(--foreground)]"
        >
          {shortAddress(address)}
        </a>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--muted)] mb-2">
        <span
          style={{ color: accent ? "var(--accent)" : "var(--muted)" }}
        >
          {icon}
        </span>
        {label}
      </div>
      <div
        className="text-xl font-bold font-mono tabular-nums"
        style={{ color: accent ? "var(--accent)" : "var(--foreground)" }}
      >
        {value}
      </div>
      <div className="text-[11px] text-[var(--muted-2)] mt-0.5">{detail}</div>
    </div>
  );
}

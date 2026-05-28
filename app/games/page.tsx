"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Coins, Trophy, Clock, Flame, Users, TrendingUp } from "lucide-react";
import { useDexStore, useHydrated, useBalance, LMS_CONFIG } from "@/lib/store";
import { formatNumber, shortAddress, timeAgoPure } from "@/lib/format";
import { toast } from "@/components/toast";
import { Eyebrow } from "@/components/ui";
import { TokenLogo } from "@/components/TokenLogo";

const USDT_BSC_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const QUICK_CHIPS = [1, 5, 10, 50];

function mmss(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function GamesPage() {
  const hydrated = useHydrated();
  const connected = useDexStore((s) => s.connected);
  const address = useDexStore((s) => s.address);
  const connectWallet = useDexStore((s) => s.connectWallet);
  const lms = useDexStore((s) => s.lms);
  const lmsEnsureRound = useDexStore((s) => s.lmsEnsureRound);
  const lmsPlaceBet = useDexStore((s) => s.lmsPlaceBet);
  const lmsCheckExpiry = useDexStore((s) => s.lmsCheckExpiry);
  const lmsClaim = useDexStore((s) => s.lmsClaim);
  const lmsBotTick = useDexStore((s) => s.lmsBotTick);
  const usdt = useBalance("USDT");

  const [amount, setAmount] = useState("5");
  // nowMs drives both the countdown display and timeAgoPure calls — pure render
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [justBetIdx, setJustBetIdx] = useState<number | null>(null);
  const [srAnnounce, setSrAnnounce] = useState("");

  const botTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const highlightRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announcedExpiryRef = useRef(false);
  const prevClaimCountRef = useRef(0);
  const prevRoundIdRef = useRef<string | null>(null);

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

  // Cleanup highlight timeout on unmount
  useEffect(() => {
    return () => {
      if (highlightRef.current) clearTimeout(highlightRef.current);
    };
  }, []);

  const parsedAmt = parseFloat(amount);
  const betAmt = Number.isFinite(parsedAmt) ? parsedAmt : 0;
  const round = lms.round;
  const history = lms.history;
  const isActive = round.status === "active";
  const overBalance = hydrated && connected && betAmt > usdt;
  const canBet =
    hydrated &&
    connected &&
    betAmt >= LMS_CONFIG.MIN_BET &&
    !overBalance &&
    isActive;

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
        ? (lms.pendingClaims ?? []).filter((c) => c.address === address)
        : [],
    [lms.pendingClaims, address],
  );

  // Sparse screen-reader announcements — fires as side-effects of state changes
  useEffect(() => {
    // Reset expiry announcement flag when round changes
    if (prevRoundIdRef.current !== round.id) {
      prevRoundIdRef.current = round.id;
      announcedExpiryRef.current = false;
      setSrAnnounce("New round started");
    }
  }, [round.id]);

  useEffect(() => {
    if (!announcedExpiryRef.current && remainingMs > 0 && remainingMs < 10_000) {
      announcedExpiryRef.current = true;
      setSrAnnounce("Round about to expire");
    }
  }, [remainingMs]);

  useEffect(() => {
    const currentCount = myClaims.length;
    if (currentCount > prevClaimCountRef.current) {
      setSrAnnounce("You won the round. Claim available.");
    }
    prevClaimCountRef.current = currentCount;
  }, [myClaims.length]);

  const handlePlaceBet = () => {
    if (!canBet) return;
    const res = lmsPlaceBet(betAmt);
    if (!res.ok) {
      toast.error(res.error ?? "Bet failed");
      return;
    }
    toast.success(`Bet ${betAmt.toFixed(2)} USDT placed!`);
    setJustBetIdx(0);
    if (highlightRef.current) clearTimeout(highlightRef.current);
    highlightRef.current = setTimeout(() => setJustBetIdx(null), 1200);
  };

  const handleClaim = (claimId: string) => {
    const res = lmsClaim(claimId);
    if (!res.ok) {
      toast.error(res.error ?? "Claim failed");
      return;
    }
    toast.success(`Claimed ${res.payout!.toFixed(2)} USDT!`);
  };

  const maxBet = () =>
    setAmount(usdt > 0 ? String(Math.floor(usdt)) : "0");

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
                Prototype · mock chain
              </span>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Place a bet. Reset the timer. Last bettor wins the pool.
            </p>
          </div>
        </div>

        <div
          title={`BSC USDT · ${USDT_BSC_ADDRESS}`}
          className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs sm:flex"
        >
          <TokenLogo symbol="USDT" size={18} />
          <span className="font-semibold">USDT</span>
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
          {srAnnounce}
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
          value={`${formatNumber(round.prizePool, 2)} USDT`}
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
          value={`${formatNumber(round.burnedPool, 2)} USDT`}
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
                        {claim.amount.toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--muted)]">
                        {timeAgoPure(claim.createdAt, nowMs)}
                      </span>
                      <button
                        onClick={() => handleClaim(claim.id)}
                        aria-label={`Claim ${claim.amount.toFixed(2)} USDT from round ${claim.roundId.slice(-4)}`}
                        className="rounded-xl bg-[var(--up)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90"
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
                    {hydrated && connected ? formatNumber(usdt, 2) : "—"} USDT
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
                  USDT
                </span>
              </div>
              <div className="mt-2 flex gap-2 flex-wrap">
                {QUICK_CHIPS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(String(v))}
                    className="rounded-lg bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                  >
                    ${v}
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
                  ? `${formatNumber(previewPrize, 2)} USDT`
                  : "—"}
              </span>
            </div>

            {/* Action button */}
            <div className="mt-5">
              {!hydrated ? (
                <div className="h-12 w-full rounded-2xl bg-[var(--surface-2)] animate-pulse-soft" />
              ) : !connected ? (
                <button
                  onClick={() => {
                    connectWallet();
                    toast.success("Wallet connected (demo)");
                  }}
                  className="h-12 w-full rounded-2xl bg-[var(--accent)] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
                >
                  Connect Wallet
                </button>
              ) : (
                <button
                  disabled={!canBet}
                  onClick={handlePlaceBet}
                  className="h-12 w-full rounded-2xl bg-[var(--accent)] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--muted-2)]"
                >
                  {!isActive
                    ? "Round ended"
                    : overBalance
                      ? "Insufficient USDT"
                      : betAmt < LMS_CONFIG.MIN_BET
                        ? `Minimum ${LMS_CONFIG.MIN_BET} USDT`
                        : `Place Your Bet · ${betAmt.toFixed(2)} USDT`}
                </button>
              )}
            </div>

            <p className="mt-3 text-center text-[11px] text-[var(--muted-2)]">
              No randomness · last bettor wins the pool · prototype only
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
            <div className="mt-3 flex gap-4 text-xs text-[var(--muted)]">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "var(--accent)" }}
                />
                Prize 80%
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "var(--up)" }}
                />
                Treasury 15%
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "var(--down)" }}
                />
                Burn 5%
              </span>
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
                {round.bets.slice(0, 12).map((bet, i) => (
                  <div
                    key={bet.id}
                    className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center rounded-xl px-2 py-1.5 text-xs transition-colors"
                    style={{
                      backgroundColor:
                        i === justBetIdx
                          ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                          : "transparent",
                    }}
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

// ─── Sub-components ───────────────────────────────────────────────────────────

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

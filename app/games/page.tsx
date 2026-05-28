"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Coins, Sparkles, Trophy, AlertTriangle } from "lucide-react";
import {
  useDexStore,
  useHydrated,
  useBalance,
} from "@/lib/store";
import { formatNumber } from "@/lib/format";
import { toast } from "@/components/toast";
import { Eyebrow } from "@/components/ui";
import { TokenLogo } from "@/components/TokenLogo";

// USDT (BSC) — placeholder mapping. The DEX's mock token registry tracks USDT
// on Ethereum, but this prototype shows the games page wired to BSC USDT for
// concept demonstration. Real chain integration is out of scope.
const USDT_BSC_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const PAYOUT_MULTIPLIER = 1.95; // 5% house edge on a 50/50 outcome
const FLIP_REVEAL_MS = 1200;

type Side = "heads" | "tails";
type FlipResult = {
  bet: number;
  choice: Side;
  outcome: Side;
  won: boolean;
  payout: number;
};

const QUICK_CHIPS = [10, 50, 100];

export default function GamesPage() {
  const hydrated = useHydrated();
  const connected = useDexStore((s) => s.connected);
  const connectWallet = useDexStore((s) => s.connectWallet);
  const placeBet = useDexStore((s) => s.placeBet);
  const transactions = useDexStore((s) => s.transactions);
  const address = useDexStore((s) => s.address);
  const usdt = useBalance("USDT");

  const [choice, setChoice] = useState<Side>("heads");
  const [amount, setAmount] = useState("10");
  const [flipping, setFlipping] = useState(false);
  const [revealed, setRevealed] = useState<FlipResult | null>(null);

  // cancel the pending reveal timeout on unmount
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const bet = parseFloat(amount) || 0;
  const payout = bet * PAYOUT_MULTIPLIER;
  const overBalance = hydrated && connected && bet > usdt;
  const canFlip =
    hydrated && connected && bet > 0 && !overBalance && !flipping;

  const recentFlips = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "bet" && t.address === address)
        .slice(0, 8),
    [transactions, address],
  );

  const flip = () => {
    if (!canFlip) return;
    setFlipping(true);
    setRevealed(null);
    timeoutRef.current = setTimeout(() => {
      const res = placeBet(choice, bet);
      if (!res.ok) {
        toast.error(res.error ?? "Bet failed");
        setFlipping(false);
        return;
      }
      setRevealed({
        bet,
        choice,
        outcome: res.outcome!,
        won: res.won!,
        payout: res.payout!,
      });
      setFlipping(false);
      if (res.won) toast.success(`Won ${res.payout!.toFixed(2)} USDT`);
      else toast.error(`Lost ${bet.toFixed(2)} USDT`);
    }, FLIP_REVEAL_MS);
  };

  const maxBet = () => setAmount(usdt > 0 ? String(Math.floor(usdt)) : "0");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Eyebrow dot="yellow" className="mb-5">
        Play · Games
      </Eyebrow>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
            <Coins className="h-6 w-6 text-[var(--accent)]" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Games</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent)]">
                <Sparkles className="h-3 w-3" />
                Prototype
              </span>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Bet USDT on the flip of a coin. Mock chain · house edge 5%.
            </p>
          </div>
        </div>

        {/* Chain pill */}
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

      {/* Game + history grid */}
      <div className="mt-6 grid gap-5 md:grid-cols-[1fr_320px]">
        {/* Coin Flip card */}
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7 shadow-2xl">
          {/* Coin */}
          <div className="flex flex-col items-center pb-5">
            <Coin
              flipping={flipping}
              face={revealed?.outcome ?? choice}
              size={132}
            />
            <div className="mt-4 h-7 text-sm">
              {flipping ? (
                <span className="text-[var(--muted)]">Flipping…</span>
              ) : revealed ? (
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold"
                  style={{
                    color: revealed.won ? "var(--up)" : "var(--down)",
                    backgroundColor: revealed.won
                      ? "color-mix(in srgb, var(--up) 12%, transparent)"
                      : "color-mix(in srgb, var(--down) 12%, transparent)",
                  }}
                >
                  {revealed.won ? (
                    <>
                      <Trophy className="h-3.5 w-3.5" />
                      Won {revealed.payout.toFixed(2)} USDT
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Lost {revealed.bet.toFixed(2)} USDT
                    </>
                  )}
                </span>
              ) : (
                <span className="text-[var(--muted-2)]">
                  Pick a side and press Flip
                </span>
              )}
            </div>
          </div>

          {/* Side selector */}
          <div className="grid grid-cols-2 gap-3">
            <SideButton
              side="heads"
              active={choice === "heads"}
              disabled={flipping}
              onClick={() => setChoice("heads")}
            />
            <SideButton
              side="tails"
              active={choice === "tails"}
              disabled={flipping}
              onClick={() => setChoice("tails")}
            />
          </div>

          {/* Bet amount */}
          <div className="mt-4 rounded-2xl bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span>Bet amount</span>
              <span>
                Balance:{" "}
                <span
                  className={
                    overBalance ? "text-[var(--down)] font-semibold" : ""
                  }
                >
                  {hydrated && connected ? formatNumber(usdt, 2) : "—"} USDT
                </span>
              </span>
            </div>
            <div className="mt-1 flex items-center">
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={flipping}
                placeholder="0"
                className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-[var(--muted-2)]"
              />
              <span className="text-sm font-semibold text-[var(--muted)]">
                USDT
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              {QUICK_CHIPS.map((v) => (
                <button
                  key={v}
                  disabled={flipping}
                  onClick={() => setAmount(String(v))}
                  className="rounded-lg bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
                >
                  ${v}
                </button>
              ))}
              <button
                disabled={flipping || !hydrated || !connected}
                onClick={maxBet}
                className="rounded-lg bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Payout summary */}
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-sm">
            <span className="text-[var(--muted)]">Potential payout</span>
            <span className="font-semibold">
              {bet > 0 ? `${payout.toFixed(2)} USDT` : "—"}
              <span className="ml-2 text-xs font-normal text-[var(--muted-2)]">
                {PAYOUT_MULTIPLIER.toFixed(2)}×
              </span>
            </span>
          </div>

          {/* Action */}
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
                disabled={!canFlip}
                onClick={flip}
                className="h-12 w-full rounded-2xl bg-[var(--accent)] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--muted-2)]"
              >
                {flipping
                  ? "Flipping…"
                  : bet <= 0
                    ? "Enter an amount"
                    : overBalance
                      ? "Insufficient USDT"
                      : `Flip coin · bet ${bet.toFixed(2)} USDT`}
              </button>
            )}
          </div>

          <p className="mt-3 text-center text-[11px] text-[var(--muted-2)]">
            Prototype only · outcomes are simulated locally, no on-chain
            settlement.
          </p>
        </div>

        {/* History sidebar */}
        <aside className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent flips</h3>
            <span className="text-xs text-[var(--muted-2)]">
              {recentFlips.length}/8
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {recentFlips.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted-2)]">
                No flips yet
              </p>
            ) : (
              recentFlips.map((t) => {
                const won = t.summary.includes("won");
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-2xl border border-[var(--border)] px-3 py-2 text-xs"
                  >
                    <span
                      className="font-semibold"
                      style={{
                        color: won ? "var(--up)" : "var(--down)",
                      }}
                    >
                      {won ? "WON" : "LOST"}
                    </span>
                    <span className="text-[var(--muted)] truncate ml-2">
                      {t.summary.replace("Coin Flip · ", "")}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------

function SideButton({
  side,
  active,
  disabled,
  onClick,
}: {
  side: Side;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const label = side === "heads" ? "Heads" : "Tails";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border ${
          side === "heads"
            ? "border-[var(--foreground)] bg-[var(--foreground)]"
            : "border-[var(--border-strong)] bg-transparent"
        }`}
        aria-hidden
      />
      {label}
    </button>
  );
}

// Animated coin face. While flipping, we spin a generic disc; once revealed,
// we settle to the actual face. Pure presentation — no game logic here.
function Coin({
  flipping,
  face,
  size,
}: {
  flipping: boolean;
  face: Side;
  size: number;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative flex items-center justify-center rounded-full ${
        flipping ? "animate-spin [animation-duration:0.6s]" : ""
      }`}
    >
      <div
        className="flex h-full w-full items-center justify-center rounded-full border-4"
        style={{
          borderColor: "var(--border-strong)",
          backgroundColor:
            face === "heads" ? "var(--foreground)" : "var(--card)",
          color: face === "heads" ? "var(--background)" : "var(--foreground)",
        }}
      >
        <span className="text-2xl font-bold tracking-widest">
          {flipping ? "?" : face === "heads" ? "H" : "T"}
        </span>
      </div>
    </div>
  );
}

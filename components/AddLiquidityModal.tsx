"use client";

import { useEffect, useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import { useAppKit } from "@reown/appkit/react";
import { POOL_MAP } from "@/lib/mock-data";
import { useDexStore, useHydrated } from "@/lib/store";
import { useBalances } from "@/lib/balances";
import { useMarket } from "@/lib/market";
import { formatNumber, formatUsd } from "@/lib/format";
import { TokenLogo } from "./TokenLogo";

export function AddLiquidityModal({
  poolId,
  onClose,
}: {
  poolId: string | null;
  onClose: () => void;
}) {
  const hydrated = useHydrated();
  const connected = useDexStore((s) => s.connected);
  const { open: openWalletModal } = useAppKit();
  const market = useMarket();
  const balances = useBalances();
  // Token-amount inputs (not a single USD total): typing one side fills the
  // other at the pool ratio so the two deposits stay equal in value.
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap: keep keyboard focus inside the dialog while it is open,
  // cycle Tab/Shift+Tab within it, and restore focus to the trigger on close.
  useEffect(() => {
    if (!poolId) return;
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => el.offsetParent !== null)
        : [];

    // move focus into the dialog (prefer the amount field)
    const amountInput = panel?.querySelector<HTMLInputElement>("input");
    (amountInput ?? focusable()[0])?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusable();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [poolId, onClose]);

  if (!poolId) return null;
  const pool = POOL_MAP[poolId];
  if (!pool) return null;

  const p0 = market[pool.token0]?.priceUsd ?? 0;
  const p1 = market[pool.token1]?.priceUsd ?? 0;
  // pool ratio: how many token1 per 1 token0 (equal USD value on both sides)
  const ratio01 = p0 > 0 && p1 > 0 ? p0 / p1 : 0;

  const n0 = parseFloat(amount0) || 0;
  const n1 = parseFloat(amount1) || 0;
  const usd0 = n0 * p0;
  const usd1 = n1 * p1;
  const total = usd0 + usd1;

  const bal0 = balances[pool.token0] ?? 0;
  const bal1 = balances[pool.token1] ?? 0;
  const enough = n0 <= bal0 && n1 <= bal1;

  const fmtAmt = (n: number) =>
    n > 0 ? String(Number(n.toFixed(6))) : "";

  // Typing one side recomputes the other at the pool ratio.
  const onChange0 = (v: string) => {
    setAmount0(v);
    const n = parseFloat(v);
    setAmount1(n > 0 && ratio01 > 0 ? fmtAmt(n * ratio01) : "");
  };
  const onChange1 = (v: string) => {
    setAmount1(v);
    const n = parseFloat(v);
    setAmount0(n > 0 && ratio01 > 0 ? fmtAmt(n / ratio01) : "");
  };
  // Quick presets set a total USD amount, split 50/50 into token counts.
  const setTotalUsd = (usd: number) => {
    onChange0(p0 > 0 ? fmtAmt(usd / 2 / p0) : "");
  };
  const setMax0 = () => onChange0(bal0 > 0 ? fmtAmt(bal0) : "");
  const setMax1 = () => onChange1(bal1 > 0 ? fmtAmt(bal1) : "");

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 p-4 pt-24">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Add liquidity to ${pool.token0} / ${pool.token1}`}
        className="animate-fade-in relative w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
      >
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-2">
            <TokenLogo symbol={pool.token0} size={28} />
            <TokenLogo symbol={pool.token1} size={28} />
            <h3 className="ml-1 text-base font-semibold">
              {pool.token0} / {pool.token1}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-5">
          {/* Pool meta + total + USD presets */}
          <div className="rounded-2xl bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span>Deposit by token amount</span>
              <span>{pool.feeTier}% fee · {pool.apr}% APR</span>
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {formatUsd(total)}{" "}
              <span className="text-sm font-normal text-[var(--muted)]">
                total
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              {[100, 500, 1000].map((v) => (
                <button
                  key={v}
                  onClick={() => setTotalUsd(v)}
                  className="rounded-lg bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {/* Editable token amounts — ratio-synced */}
          <div className="mt-3 space-y-2">
            <AmountRow
              symbol={pool.token0}
              value={amount0}
              onChange={onChange0}
              onMax={setMax0}
              balance={bal0}
              usd={usd0}
            />
            <div className="flex justify-center">
              <Plus className="h-4 w-4 text-[var(--muted-2)]" />
            </div>
            <AmountRow
              symbol={pool.token1}
              value={amount1}
              onChange={onChange1}
              onMax={setMax1}
              balance={bal1}
              usd={usd1}
            />
          </div>

          {ratio01 > 0 && (
            <p className="mt-3 text-center text-xs text-[var(--muted-2)]">
              1 {pool.token0} = {formatNumber(ratio01, 6)} {pool.token1}
            </p>
          )}

          <div className="mt-4">
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
                {total <= 0
                  ? "Enter an amount"
                  : !enough
                    ? "Insufficient balance"
                    : "On-chain pools coming soon"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AmountRow({
  symbol,
  value,
  onChange,
  onMax,
  balance,
  usd,
}: {
  symbol: string;
  value: string;
  onChange: (v: string) => void;
  onMax: () => void;
  balance: number;
  usd: number;
}) {
  const short = (parseFloat(value) || 0) > balance;
  return (
    <div className="rounded-2xl border border-[var(--border)] px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <TokenLogo symbol={symbol} size={32} />
          <div className="text-sm font-semibold">{symbol}</div>
        </div>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          aria-label={`${symbol} amount`}
          className="w-1/2 bg-transparent text-right text-lg font-semibold outline-none placeholder:text-[var(--muted-2)]"
          style={{ color: short ? "var(--down)" : undefined }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs text-[var(--muted)]">
        <button
          onClick={onMax}
          className="transition-colors hover:text-[var(--foreground)]"
        >
          Balance: {formatNumber(balance, 4)}{" "}
          <span className="font-medium text-[var(--accent)]">MAX</span>
        </button>
        <span>{formatUsd(usd)}</span>
      </div>
    </div>
  );
}

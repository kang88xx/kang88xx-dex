"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { POOL_MAP, TOKEN_MAP } from "@/lib/mock-data";
import { useBalances, useDexStore, useHydrated } from "@/lib/store";
import { formatNumber, formatUsd } from "@/lib/format";
import { TokenLogo } from "./TokenLogo";
import { toast } from "./toast";

export function AddLiquidityModal({
  poolId,
  onClose,
}: {
  poolId: string | null;
  onClose: () => void;
}) {
  const hydrated = useHydrated();
  const connected = useDexStore((s) => s.connected);
  const connectWallet = useDexStore((s) => s.connectWallet);
  const addLiquidity = useDexStore((s) => s.addLiquidity);
  const balances = useBalances();
  const [amount, setAmount] = useState("");

  if (!poolId) return null;
  const pool = POOL_MAP[poolId];
  if (!pool) return null;

  const t0 = TOKEN_MAP[pool.token0];
  const t1 = TOKEN_MAP[pool.token1];
  const usd = parseFloat(amount) || 0;
  const perSide = usd / 2;
  const need0 = perSide / t0.priceUsd;
  const need1 = perSide / t1.priceUsd;

  const bal0 = balances[pool.token0] ?? 0;
  const bal1 = balances[pool.token1] ?? 0;
  const enough = need0 <= bal0 && need1 <= bal1;

  const submit = () => {
    const res = addLiquidity(poolId, usd);
    if (res.ok) {
      toast.success(`Added ${formatUsd(usd)} to ${pool.token0}/${pool.token1}`);
      setAmount("");
      onClose();
    } else {
      toast.error(res.error ?? "Failed to add liquidity");
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 p-4 pt-24">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="animate-fade-in relative w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
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
          <div className="rounded-2xl bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span>Deposit amount (total)</span>
              <span>{pool.feeTier}% fee · {pool.apr}% APR</span>
            </div>
            <div className="mt-1 flex items-center">
              <span className="text-2xl font-semibold text-[var(--muted)]">
                $
              </span>
              <input
                type="number"
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-[var(--muted-2)]"
              />
            </div>
            <div className="mt-2 flex gap-2">
              {[100, 500, 1000].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(String(v))}
                  className="rounded-lg bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {/* Split breakdown */}
          <div className="mt-3 space-y-2">
            <SplitRow
              symbol={pool.token0}
              amount={need0}
              balance={bal0}
              usd={perSide}
            />
            <div className="flex justify-center">
              <Plus className="h-4 w-4 text-[var(--muted-2)]" />
            </div>
            <SplitRow
              symbol={pool.token1}
              amount={need1}
              balance={bal1}
              usd={perSide}
            />
          </div>

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
                disabled={usd <= 0 || !enough}
                onClick={submit}
                className="h-12 w-full rounded-2xl bg-[var(--accent)] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--muted-2)]"
              >
                {usd <= 0
                  ? "Enter an amount"
                  : !enough
                    ? "Insufficient balance"
                    : "Add liquidity"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SplitRow({
  symbol,
  amount,
  balance,
  usd,
}: {
  symbol: string;
  amount: number;
  balance: number;
  usd: number;
}) {
  const short = amount > balance;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3">
      <div className="flex items-center gap-2.5">
        <TokenLogo symbol={symbol} size={32} />
        <div>
          <div className="text-sm font-semibold">{symbol}</div>
          <div className="text-xs text-[var(--muted)]">
            Balance: {formatNumber(balance, 4)}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div
          className="text-sm font-semibold"
          style={{ color: short ? "var(--down)" : undefined }}
        >
          {formatNumber(amount, 6)}
        </div>
        <div className="text-xs text-[var(--muted)]">{formatUsd(usd)}</div>
      </div>
    </div>
  );
}

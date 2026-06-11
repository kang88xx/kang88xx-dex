"use client";

import { useMemo, useState } from "react";
import { Plus, Minus, Droplets } from "lucide-react";
import { formatUnits } from "viem";
import { useDexStore, useHydrated } from "@/lib/store";
import { useMarket } from "@/lib/market";
import { formatCompact, formatNumber, formatUsd } from "@/lib/format";
import { usePoolStats, type PoolStats } from "@/lib/pool-stats";
import { useAllTokenMap, usePoolsOnchain } from "@/lib/liquidity";
import { TokenPair } from "@/components/TokenLogo";
import { AddLiquidityModal } from "@/components/AddLiquidityModal";
import { RemoveLiquidityModal } from "@/components/RemoveLiquidityModal";
import { Eyebrow } from "@/components/ui";

/** Format a live APR percent, or "—"/"…" when unavailable/loading. */
function aprText(s: PoolStats | undefined): string {
  if (!s || s.loading) return "…";
  if (!s.available) return "—";
  return `${s.apr.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

/** Format a live USD stat (TVL / volume), or "—"/"…". */
function usdText(
  s: PoolStats | undefined,
  pick: (s: PoolStats) => number,
): string {
  if (!s || s.loading) return "…";
  if (!s.available) return "—";
  return `$${formatCompact(pick(s))}`;
}

export default function PoolsPage() {
  const hydrated = useHydrated();
  const pools = useDexStore((s) => s.pools);
  const hiddenPools = useDexStore((s) => s.hiddenPools);
  // Hidden pools drop out of the public list, but positions below still scan
  // ALL pools so existing LPs can always withdraw.
  const visiblePools = useMemo(() => {
    const hidden = new Set(hiddenPools ?? []);
    return pools.filter((p) => !hidden.has(p.id));
  }, [pools, hiddenPools]);
  const stats = usePoolStats(pools);
  const onchain = usePoolsOnchain(pools);
  const tokenMap = useAllTokenMap();
  const market = useMarket();
  const [addPool, setAddPool] = useState<string | null>(null);
  const [removePool, setRemovePool] = useState<string | null>(null);

  // Real positions: pools where the connected wallet holds LP tokens.
  const positions = useMemo(
    () =>
      pools.flatMap((pool) => {
        const oc = onchain[pool.id];
        if (!oc || oc.lpBalance <= 0n || oc.totalSupply <= 0n) return [];
        const tA = tokenMap[pool.token0];
        const tB = tokenMap[pool.token1];
        if (!tA || !tB) return [];
        const amtA = Number(
          formatUnits((oc.reserveA * oc.lpBalance) / oc.totalSupply, tA.decimals),
        );
        const amtB = Number(
          formatUnits((oc.reserveB * oc.lpBalance) / oc.totalSupply, tB.decimals),
        );
        const sharePct =
          Number((oc.lpBalance * 1_000_000n) / oc.totalSupply) / 10_000;
        const amountUsd =
          amtA * (market[pool.token0]?.priceUsd ?? 0) +
          amtB * (market[pool.token1]?.priceUsd ?? 0);
        return [{ pool, amtA, amtB, sharePct, amountUsd }];
      }),
    [pools, onchain, tokenMap, market],
  );
  const positionIds = new Set(positions.map((p) => p.pool.id));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Eyebrow dot="blue" className="mb-4">
        01 — Liquidity
      </Eyebrow>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">
            Liquidity Pools
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Provide liquidity to earn trading fees and rewards.
          </p>
        </div>
      </div>

      {/* Your positions — read live from the wallet's LP token balances */}
      {hydrated && positions.length > 0 && (
        <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Droplets className="h-4 w-4 text-[var(--accent)]" />
            Your positions
          </h2>
          <div className="mt-4 space-y-2">
            {positions.map(({ pool, amtA, amtB, sharePct, amountUsd }) => (
              <div
                key={pool.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--surface)] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <TokenPair token0={pool.token0} token1={pool.token1} />
                  <div>
                    <div className="text-sm font-semibold">
                      {pool.token0} / {pool.token1}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {formatNumber(amtA, 4)} {pool.token0} +{" "}
                      {formatNumber(amtB, 4)} {pool.token1} ·{" "}
                      {sharePct.toFixed(3)}% of pool
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {formatUsd(amountUsd)}
                    </div>
                    <div className="text-xs text-[var(--up)]">
                      {aprText(stats[pool.id])} APR
                    </div>
                  </div>
                  <button
                    onClick={() => setRemovePool(pool.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                  >
                    <Minus className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All pools */}
      <div className="mt-8 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
              <th className="px-5 py-3 font-medium">Pool</th>
              <th className="px-2 py-3 text-right font-medium">TVL</th>
              <th className="hidden px-2 py-3 text-right font-medium sm:table-cell">
                Volume 24h
              </th>
              <th className="px-2 py-3 text-right font-medium">APR</th>
              <th className="px-5 py-3 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visiblePools.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-12 text-center text-sm text-[var(--muted)]"
                >
                  No pools yet — create one from the Admin panel.
                </td>
              </tr>
            )}
            {visiblePools.map((p) => {
              const hasPos = positionIds.has(p.id);
              return (
                <tr
                  key={p.id}
                  className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--surface)]"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <TokenPair token0={p.token0} token1={p.token1} />
                      <div>
                        <div className="flex items-center gap-2 font-semibold">
                          {p.token0} / {p.token1}
                          {hasPos && (
                            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {p.feeTier}% fee tier
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-4 text-right font-medium">
                    {usdText(stats[p.id], (s) => s.tvlUsd)}
                  </td>
                  <td className="hidden px-2 py-4 text-right text-[var(--muted)] sm:table-cell">
                    {usdText(stats[p.id], (s) => s.volume24h)}
                  </td>
                  <td className="px-2 py-4 text-right font-semibold text-[var(--up)]">
                    {aprText(stats[p.id])}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setAddPool(p.id)}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AddLiquidityModal poolId={addPool} onClose={() => setAddPool(null)} />
      <RemoveLiquidityModal
        poolId={removePool}
        onClose={() => setRemovePool(null)}
      />
    </div>
  );
}

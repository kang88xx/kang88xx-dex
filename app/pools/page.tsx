"use client";

import { useState } from "react";
import { Plus, Minus, Droplets } from "lucide-react";
import { useDexStore, useHydrated, usePositions } from "@/lib/store";
import { formatCompact, formatUsd } from "@/lib/format";
import { usePoolStats, type PoolStats } from "@/lib/pool-stats";
import { TokenPair } from "@/components/TokenLogo";
import { AddLiquidityModal } from "@/components/AddLiquidityModal";
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
  const positions = usePositions();
  const pools = useDexStore((s) => s.pools);
  const stats = usePoolStats(pools);
  const [addPool, setAddPool] = useState<string | null>(null);

  const poolMap = new Map(pools.map((p) => [p.id, p]));
  // Ignore any persisted positions whose pool no longer exists.
  const knownPositions = positions.filter((p) => poolMap.has(p.poolId));
  const positionMap = new Map(knownPositions.map((p) => [p.poolId, p]));

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

      {/* Your positions */}
      {hydrated && knownPositions.length > 0 && (
        <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Droplets className="h-4 w-4 text-[var(--accent)]" />
            Your positions
          </h2>
          <div className="mt-4 space-y-2">
            {knownPositions.map((p) => {
              const pool = poolMap.get(p.poolId)!;
              return (
                <div
                  key={p.poolId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--surface)] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <TokenPair token0={pool.token0} token1={pool.token1} />
                    <div>
                      <div className="text-sm font-semibold">
                        {pool.token0} / {pool.token1}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {p.sharePct.toFixed(3)}% of pool
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {formatUsd(p.amountUsd)}
                      </div>
                      <div className="text-xs text-[var(--up)]">
                        {aprText(stats[p.poolId])} APR
                      </div>
                    </div>
                    <button
                      disabled
                      title="On-chain pools coming soon"
                      className="inline-flex cursor-not-allowed items-center gap-1 rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--muted-2)]"
                    >
                      <Minus className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
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
            {pools.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-12 text-center text-sm text-[var(--muted)]"
                >
                  No pools yet — create one from the Admin panel.
                </td>
              </tr>
            )}
            {pools.map((p) => {
              const hasPos = positionMap.has(p.id);
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
    </div>
  );
}

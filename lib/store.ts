"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useSyncExternalStore } from "react";
import type { AirdropCampaign, LpPosition, Transaction } from "./types";
import {
  ADMIN_PASSWORD,
  POOL_MAP,
  TOKEN_MAP,
  seedCampaigns,
} from "./mock-data";

// Demo starting balances handed to every freshly-connected wallet
const DEFAULT_BALANCES: Record<string, number> = {
  ETH: 4.82,
  WBTC: 0.182,
  USDC: 12450,
  USDT: 3200,
  DAI: 800,
  UNI: 320,
  LINK: 540,
  ARB: 1500,
  AAVE: 12.4,
  MATIC: 4200,
  IOI: 0,
};

const SWAP_FEE = 0.003; // 0.3%

function randomAddress(): string {
  const hex = "0123456789abcdef";
  let a = "0x";
  for (let i = 0; i < 40; i++) a += hex[Math.floor(Math.random() * 16)];
  return a;
}

function uid(prefix = ""): string {
  return prefix + Math.random().toString(36).slice(2, 10);
}

interface DexState {
  // wallet
  connected: boolean;
  address: string | null;
  isAdmin: boolean;

  // per-address data
  balances: Record<string, Record<string, number>>;
  positions: Record<string, LpPosition[]>;
  claims: Record<string, string[]>;

  transactions: Transaction[];
  campaigns: AirdropCampaign[];

  // wallet actions
  connectWallet: () => void;
  disconnectWallet: () => void;
  loginAdmin: (pw: string) => boolean;
  logoutAdmin: () => void;

  // trading
  swap: (
    from: string,
    to: string,
    amountIn: number,
  ) => { ok: boolean; error?: string; amountOut?: number };
  addLiquidity: (
    poolId: string,
    amountUsd: number,
  ) => { ok: boolean; error?: string };
  removeLiquidity: (poolId: string) => { ok: boolean };

  // airdrops
  claimAirdrop: (campaignId: string) => { ok: boolean; error?: string };

  // admin
  createCampaign: (
    c: Omit<AirdropCampaign, "id" | "claimedCount" | "createdAt">,
  ) => void;
  updateCampaign: (id: string, patch: Partial<AirdropCampaign>) => void;
  deleteCampaign: (id: string) => void;
  addToWhitelist: (campaignId: string, address: string) => void;
  removeFromWhitelist: (campaignId: string, address: string) => void;
}

function pushTx(
  txs: Transaction[],
  type: Transaction["type"],
  summary: string,
  address: string,
): Transaction[] {
  return [
    { id: uid("tx_"), type, summary, timestamp: Date.now(), address },
    ...txs,
  ].slice(0, 60);
}

export const useDexStore = create<DexState>()(
  persist(
    (set, get) => ({
      connected: false,
      address: null,
      isAdmin: false,
      balances: {},
      positions: {},
      claims: {},
      transactions: [],
      campaigns: seedCampaigns(),

      connectWallet: () => {
        const existing = get().address;
        const address = existing ?? randomAddress();
        set((s) => ({
          connected: true,
          address,
          balances: s.balances[address]
            ? s.balances
            : { ...s.balances, [address]: { ...DEFAULT_BALANCES } },
        }));
      },

      disconnectWallet: () => set({ connected: false, isAdmin: false }),

      loginAdmin: (pw) => {
        if (pw === ADMIN_PASSWORD) {
          set({ isAdmin: true });
          return true;
        }
        return false;
      },

      logoutAdmin: () => set({ isAdmin: false }),

      swap: (from, to, amountIn) => {
        const { address, balances } = get();
        if (!address) return { ok: false, error: "Connect your wallet first" };
        const tFrom = TOKEN_MAP[from];
        const tTo = TOKEN_MAP[to];
        if (!tFrom || !tTo) return { ok: false, error: "Unknown token" };
        if (from === to) return { ok: false, error: "Select two different tokens" };
        if (!amountIn || amountIn <= 0)
          return { ok: false, error: "Enter an amount" };
        const bal = balances[address]?.[from] ?? 0;
        if (amountIn > bal) return { ok: false, error: `Insufficient ${from}` };

        const amountOut =
          ((amountIn * tFrom.priceUsd) / tTo.priceUsd) * (1 - SWAP_FEE);

        set((s) => {
          const a = { ...(s.balances[address] ?? {}) };
          a[from] = (a[from] ?? 0) - amountIn;
          a[to] = (a[to] ?? 0) + amountOut;
          return {
            balances: { ...s.balances, [address]: a },
            transactions: pushTx(
              s.transactions,
              "swap",
              `Swapped ${amountIn.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${from} → ${amountOut.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${to}`,
              address,
            ),
          };
        });
        return { ok: true, amountOut };
      },

      addLiquidity: (poolId, amountUsd) => {
        const { address, balances } = get();
        if (!address) return { ok: false, error: "Connect your wallet first" };
        const pool = POOL_MAP[poolId];
        if (!pool) return { ok: false, error: "Unknown pool" };
        if (!amountUsd || amountUsd <= 0)
          return { ok: false, error: "Enter an amount" };

        const t0 = TOKEN_MAP[pool.token0];
        const t1 = TOKEN_MAP[pool.token1];
        const perSide = amountUsd / 2;
        const need0 = perSide / t0.priceUsd;
        const need1 = perSide / t1.priceUsd;
        const a = { ...(balances[address] ?? {}) };
        if ((a[pool.token0] ?? 0) < need0)
          return { ok: false, error: `Insufficient ${pool.token0}` };
        if ((a[pool.token1] ?? 0) < need1)
          return { ok: false, error: `Insufficient ${pool.token1}` };

        a[pool.token0] -= need0;
        a[pool.token1] -= need1;
        const sharePct = (amountUsd / (pool.tvlUsd + amountUsd)) * 100;

        set((s) => {
          const existing = s.positions[address] ?? [];
          const idx = existing.findIndex((p) => p.poolId === poolId);
          let positions: LpPosition[];
          if (idx >= 0) {
            positions = existing.map((p, i) => {
              if (i !== idx) return p;
              const total = p.amountUsd + amountUsd;
              return {
                ...p,
                amountUsd: total,
                sharePct: (total / (pool.tvlUsd + total)) * 100,
              };
            });
          } else {
            positions = [...existing, { poolId, amountUsd, sharePct }];
          }
          return {
            balances: { ...s.balances, [address]: a },
            positions: { ...s.positions, [address]: positions },
            transactions: pushTx(
              s.transactions,
              "add-liquidity",
              `Added liquidity to ${pool.token0}/${pool.token1} ($${amountUsd.toLocaleString()})`,
              address,
            ),
          };
        });
        return { ok: true };
      },

      removeLiquidity: (poolId) => {
        const { address, positions, balances } = get();
        if (!address) return { ok: false };
        const list = positions[address] ?? [];
        const pos = list.find((p) => p.poolId === poolId);
        if (!pos) return { ok: false };
        const pool = POOL_MAP[poolId];
        if (!pool) return { ok: false };
        const t0 = TOKEN_MAP[pool.token0];
        const t1 = TOKEN_MAP[pool.token1];
        const perSide = pos.amountUsd / 2;
        const a = { ...(balances[address] ?? {}) };
        a[pool.token0] = (a[pool.token0] ?? 0) + perSide / t0.priceUsd;
        a[pool.token1] = (a[pool.token1] ?? 0) + perSide / t1.priceUsd;

        set((s) => ({
          balances: { ...s.balances, [address]: a },
          positions: {
            ...s.positions,
            [address]: (s.positions[address] ?? []).filter(
              (p) => p.poolId !== poolId,
            ),
          },
          transactions: pushTx(
            s.transactions,
            "remove-liquidity",
            `Removed liquidity from ${pool.token0}/${pool.token1}`,
            address,
          ),
        }));
        return { ok: true };
      },

      claimAirdrop: (campaignId) => {
        const { address, campaigns, claims, positions } = get();
        if (!address) return { ok: false, error: "Connect your wallet first" };
        const c = campaigns.find((x) => x.id === campaignId);
        if (!c) return { ok: false, error: "Campaign not found" };
        if (!c.active) return { ok: false, error: "Campaign is not active" };
        if (c.endsAt <= Date.now())
          return { ok: false, error: "Campaign has ended" };
        if ((c.claimedCount + 1) * c.amountPerClaim > c.totalAllocation)
          return { ok: false, error: "Allocation fully claimed" };
        if ((claims[address] ?? []).includes(campaignId))
          return { ok: false, error: "Already claimed" };

        if (c.eligibility === "whitelist") {
          if (!c.whitelist.includes(address.toLowerCase()))
            return { ok: false, error: "Wallet not whitelisted" };
        } else if (c.eligibility === "lp") {
          const hasLp = (positions[address] ?? []).some(
            (p) => p.poolId === c.requiredPoolId,
          );
          if (!hasLp)
            return {
              ok: false,
              error: "Requires a liquidity position in the linked pool",
            };
        }

        set((s) => {
          const a = { ...(s.balances[address] ?? {}) };
          a[c.tokenSymbol] = (a[c.tokenSymbol] ?? 0) + c.amountPerClaim;
          return {
            balances: { ...s.balances, [address]: a },
            claims: {
              ...s.claims,
              [address]: [...(s.claims[address] ?? []), campaignId],
            },
            campaigns: s.campaigns.map((x) =>
              x.id === campaignId
                ? { ...x, claimedCount: x.claimedCount + 1 }
                : x,
            ),
            transactions: pushTx(
              s.transactions,
              "claim",
              `Claimed ${c.amountPerClaim.toLocaleString()} ${c.tokenSymbol} from "${c.name}"`,
              address,
            ),
          };
        });
        return { ok: true };
      },

      createCampaign: (c) =>
        set((s) => ({
          campaigns: [
            {
              ...c,
              id: uid("camp_"),
              claimedCount: 0,
              createdAt: Date.now(),
              whitelist: c.whitelist.map((w) => w.toLowerCase()),
            },
            ...s.campaigns,
          ],
        })),

      updateCampaign: (id, patch) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        })),

      deleteCampaign: (id) =>
        set((s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id) })),

      addToWhitelist: (campaignId, address) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) => {
            if (c.id !== campaignId) return c;
            const addr = address.trim().toLowerCase();
            if (!addr || c.whitelist.includes(addr)) return c;
            return { ...c, whitelist: [...c.whitelist, addr] };
          }),
        })),

      removeFromWhitelist: (campaignId, address) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  whitelist: c.whitelist.filter(
                    (w) => w !== address.toLowerCase(),
                  ),
                }
              : c,
          ),
        })),
    }),
    {
      // bumped from helix-dex-store → reseeds with IOI tokens/campaigns
      name: "ioi-dex-store",
      version: 2,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// ------------------------------------------------------------------
//  Hydration guard — avoids SSR/CSR mismatch for persisted state
// ------------------------------------------------------------------

// useSyncExternalStore gives a server snapshot (false) and a client snapshot
// (true) without a set-state-in-effect, so persisted/client-only UI can gate
// safely and stay lint-clean under React 19 hooks rules.
const noopSubscribe = () => () => {};
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

// Convenience selectors -------------------------------------------------
// NB: return *stable* empty references so zustand v5's Object.is snapshot
// comparison does not trigger an infinite render loop.

const EMPTY_BALANCES: Record<string, number> = {};
const EMPTY_POSITIONS: LpPosition[] = [];
const EMPTY_IDS: string[] = [];

export function useBalances(): Record<string, number> {
  return useDexStore((s) =>
    s.address ? s.balances[s.address] ?? EMPTY_BALANCES : EMPTY_BALANCES,
  );
}

export function useBalance(symbol: string): number {
  return useDexStore((s) =>
    s.address ? s.balances[s.address]?.[symbol] ?? 0 : 0,
  );
}

export function usePositions(): LpPosition[] {
  return useDexStore((s) =>
    s.address ? s.positions[s.address] ?? EMPTY_POSITIONS : EMPTY_POSITIONS,
  );
}

export function useClaimedIds(): string[] {
  return useDexStore((s) =>
    s.address ? s.claims[s.address] ?? EMPTY_IDS : EMPTY_IDS,
  );
}

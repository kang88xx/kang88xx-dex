"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useSyncExternalStore } from "react";
import type {
  AirdropCampaign,
  LpPosition,
  LmsBet,
  LmsRound,
  LmsHistoryEntry,
  LmsPendingClaim,
  Transaction,
} from "./types";
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

// ─── Last Man Standing config (exported so UI can import) ────────────────────
export const LMS_CONFIG = {
  MIN_BET: 1,
  BET_ADDS_MS: 30_000,
  MAX_REMAINING_MS: 120_000,
  FEE_PRIZE: 0.8,
  FEE_TREASURY: 0.15,
  FEE_BURN: 0.05,
  BOT_TICK_MS: 10_000,
  BOT_PROBABILITY: 0.6,
  MAX_BOT_BETS: 5,
  PENDING_CLAIMS_CAP: 50,
  HISTORY_CAP: 20,
};

const PHANTOM_BOTS: string[] = [
  "0xdeadbeef00000000000000000000000000000001",
  "0xdeadbeef00000000000000000000000000000002",
  "0xdeadbeef00000000000000000000000000000003",
  "0xdeadbeef00000000000000000000000000000004",
  "0xdeadbeef00000000000000000000000000000005",
  "0xdeadbeef00000000000000000000000000000006",
];

function randomAddress(): string {
  const hex = "0123456789abcdef";
  let a = "0x";
  for (let i = 0; i < 40; i++) a += hex[Math.floor(Math.random() * 16)];
  return a;
}

function uid(prefix = ""): string {
  return prefix + Math.random().toString(36).slice(2, 10);
}

function makeFreshRound(): LmsRound {
  return {
    id: uid("round_"),
    status: "active",
    endsAt: Date.now() + 60_000,
    prizePool: 0,
    treasuryPool: 0,
    burnedPool: 0,
    lastBettor: null,
    bets: [],
    botBetCount: 0,
  };
}

function applyBetToRound(
  round: LmsRound,
  bettor: string,
  amount: number,
): LmsRound {
  const prize = amount * LMS_CONFIG.FEE_PRIZE;
  const treasury = amount * LMS_CONFIG.FEE_TREASURY;
  const burn = amount - prize - treasury;

  const now = Date.now();
  const newBet: LmsBet = {
    id: uid("bet_"),
    address: bettor,
    amount,
    timestamp: now,
    roundId: round.id,
  };

  const currentRemaining = round.endsAt - now;
  const newRemaining = Math.min(
    currentRemaining + LMS_CONFIG.BET_ADDS_MS,
    LMS_CONFIG.MAX_REMAINING_MS,
  );
  const newEndsAt = now + newRemaining;

  return {
    ...round,
    prizePool: round.prizePool + prize,
    treasuryPool: round.treasuryPool + treasury,
    burnedPool: round.burnedPool + burn,
    lastBettor: bettor,
    endsAt: newEndsAt,
    bets: [newBet, ...round.bets],
  };
}

// ─── Pure round-finalization helper ──────────────────────────────────────────
function finalizeRoundIfExpired(
  round: LmsRound,
  history: LmsHistoryEntry[],
  pendingClaims: LmsPendingClaim[],
  now: number,
): { round: LmsRound; history: LmsHistoryEntry[]; pendingClaims: LmsPendingClaim[] } | null {
  if (round.endsAt > now) return null;

  // Empty round — no winner, just start fresh
  if (!round.lastBettor) {
    return { round: makeFreshRound(), history, pendingClaims };
  }

  const isBot = PHANTOM_BOTS.includes(round.lastBettor);
  const historyEntry: LmsHistoryEntry = {
    roundId: round.id,
    winner: round.lastBettor,
    prize: round.prizePool,
    endedAt: round.endsAt,
    isBot,
  };

  let newPendingClaims = pendingClaims;
  if (!isBot) {
    const claim: LmsPendingClaim = {
      id: uid("claim_"),
      roundId: round.id,
      address: round.lastBettor,
      amount: round.prizePool,
      createdAt: now,
    };
    newPendingClaims = [claim, ...pendingClaims].slice(0, LMS_CONFIG.PENDING_CLAIMS_CAP);
  }

  const newHistory = [historyEntry, ...history].slice(0, LMS_CONFIG.HISTORY_CAP);

  return { round: makeFreshRound(), history: newHistory, pendingClaims: newPendingClaims };
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

  // Last Man Standing
  lms: {
    round: LmsRound;
    history: LmsHistoryEntry[];
    pendingClaims: LmsPendingClaim[];
  };

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

  // games — Last Man Standing
  lmsEnsureRound: () => void;
  lmsPlaceBet: (amount: number) => { ok: boolean; error?: string };
  lmsCheckExpiry: () => void;
  lmsClaim: (claimId: string) => { ok: boolean; error?: string; payout?: number };
  lmsBotTick: () => void;

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
      lms: {
        round: makeFreshRound(),
        history: [],
        pendingClaims: [],
      },

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

      // ─── Last Man Standing actions ───────────────────────────────────────

      lmsEnsureRound: () => {
        const { lms } = get();
        const now = Date.now();
        if (!lms.round) {
          set((s) => ({ lms: { ...s.lms, round: makeFreshRound() } }));
          return;
        }
        const result = finalizeRoundIfExpired(
          lms.round,
          lms.history,
          lms.pendingClaims,
          now,
        );
        if (result) {
          set((s) => ({ lms: { ...s.lms, ...result } }));
        }
      },

      lmsPlaceBet: (amount) => {
        const { address, balances, lms } = get();
        if (!address) return { ok: false, error: "Connect your wallet first" };
        if (!Number.isFinite(amount)) return { ok: false, error: "Invalid amount" };
        if (!amount || amount < LMS_CONFIG.MIN_BET)
          return {
            ok: false,
            error: `Minimum bet is ${LMS_CONFIG.MIN_BET} USDT`,
          };
        const usdt = balances[address]?.USDT ?? 0;
        if (amount > usdt) return { ok: false, error: "Insufficient USDT" };

        const now = Date.now();
        // Finalize if expired before applying bet
        const expiredResult = finalizeRoundIfExpired(
          lms.round,
          lms.history,
          lms.pendingClaims,
          now,
        );
        if (expiredResult) {
          set((s) => ({ lms: { ...s.lms, ...expiredResult } }));
          return { ok: false, error: "Round just ended — new round started" };
        }

        if (lms.round.status !== "active")
          return { ok: false, error: "Round is not active" };

        const updatedRound = applyBetToRound(lms.round, address, amount);

        set((s) => {
          const a = { ...(s.balances[address] ?? {}) };
          a.USDT = (a.USDT ?? 0) - amount;
          return {
            balances: { ...s.balances, [address]: a },
            lms: { ...s.lms, round: updatedRound },
            transactions: pushTx(
              s.transactions,
              "bet",
              `Placed ${amount.toFixed(2)} USDT into round #${lms.round.id}`,
              address,
            ),
          };
        });
        return { ok: true };
      },

      lmsCheckExpiry: () => {
        const { lms } = get();
        const now = Date.now();
        const result = finalizeRoundIfExpired(
          lms.round,
          lms.history,
          lms.pendingClaims,
          now,
        );
        if (result) {
          set((s) => ({ lms: { ...s.lms, ...result } }));
        }
      },

      lmsClaim: (claimId: string) => {
        const { address, lms } = get();
        if (!address) return { ok: false, error: "Connect your wallet first" };
        const claim = lms.pendingClaims.find((c) => c.id === claimId);
        if (!claim) return { ok: false, error: "Claim not found" };
        if (claim.address !== address) return { ok: false, error: "You are not the winner" };

        const payout = claim.amount;

        set((s) => {
          const a = { ...(s.balances[address] ?? {}) };
          a.USDT = (a.USDT ?? 0) + payout;
          return {
            balances: { ...s.balances, [address]: a },
            lms: {
              ...s.lms,
              pendingClaims: s.lms.pendingClaims.filter((c) => c.id !== claimId),
            },
            transactions: pushTx(
              s.transactions,
              "claim",
              `Claimed ${payout.toFixed(2)} USDT from round #${claim.roundId}`,
              address,
            ),
          };
        });
        return { ok: true, payout };
      },

      lmsBotTick: () => {
        const { lms } = get();
        if (lms.round.status !== "active") return;
        const now = Date.now();
        const remaining = lms.round.endsAt - now;
        if (remaining <= 5_000) return;
        if (lms.round.botBetCount >= LMS_CONFIG.MAX_BOT_BETS) return;

        // Check last bet time (skip if a bet was placed within the last 5s)
        const lastBet = lms.round.bets[0];
        if (lastBet && now - lastBet.timestamp < 5_000) return;

        if (Math.random() >= LMS_CONFIG.BOT_PROBABILITY) return;

        const botAddr =
          PHANTOM_BOTS[Math.floor(Math.random() * PHANTOM_BOTS.length)];
        const betAmount = Math.floor(Math.random() * 5) + 1; // 1-5 USDT

        const updatedRound = applyBetToRound(lms.round, botAddr, betAmount);

        set((s) => ({
          lms: {
            ...s.lms,
            round: {
              ...updatedRound,
              botBetCount: s.lms.round.botBetCount + 1,
            },
          },
        }));
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
      // v3: replaced Coin Flip with Last Man Standing
      // v4: unified round finalization, pendingClaims, LMS_CONFIG export
      name: "ioi-dex-store",
      version: 4,
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

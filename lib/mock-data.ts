import type { Pool, AirdropCampaign } from "./types";
import { TOKEN_MAP } from "./tokens";

// Token registry moved to lib/tokens.ts (BSC). Re-exported here so existing
// imports keep working during the production transition.
export { TOKENS, TOKEN_MAP, getToken } from "./tokens";

// ------------------------------------------------------------------
//  Liquidity pools (BSC pairs — TVL/APR are placeholder numbers until
//  real on-chain pools ship)
// ------------------------------------------------------------------

export const POOLS: Pool[] = [
  { id: "bnb-usdt", token0: "BNB", token1: "USDT", feeTier: 0.05, tvlUsd: 184_200_000, volume24h: 96_400_000, apr: 18.4 },
  { id: "btcb-bnb", token0: "BTCB", token1: "BNB", feeTier: 0.3, tvlUsd: 142_800_000, volume24h: 54_100_000, apr: 12.9 },
  { id: "eth-usdt", token0: "ETH", token1: "USDT", feeTier: 0.05, tvlUsd: 98_300_000, volume24h: 41_200_000, apr: 15.1 },
  { id: "usdc-usdt", token0: "USDC", token1: "USDT", feeTier: 0.01, tvlUsd: 76_500_000, volume24h: 120_900_000, apr: 6.2 },
  { id: "ioi-bnb", token0: "IOI", token1: "BNB", feeTier: 0.3, tvlUsd: 22_400_000, volume24h: 8_900_000, apr: 64.3 },
  { id: "cake-bnb", token0: "CAKE", token1: "BNB", feeTier: 0.3, tvlUsd: 18_900_000, volume24h: 6_200_000, apr: 22.7 },
  { id: "link-usdt", token0: "LINK", token1: "USDT", feeTier: 0.3, tvlUsd: 12_100_000, volume24h: 3_400_000, apr: 19.8 },
  { id: "doge-bnb", token0: "DOGE", token1: "BNB", feeTier: 0.3, tvlUsd: 9_700_000, volume24h: 2_800_000, apr: 28.5 },
];

export const POOL_MAP: Record<string, Pool> = Object.fromEntries(
  POOLS.map((p) => [p.id, p]),
);

// ------------------------------------------------------------------
//  Deterministic price-history generator (stable across SSR/CSR)
// ------------------------------------------------------------------

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PricePoint {
  t: number; // index / label
  label: string;
  price: number;
}

export type ChartRange = "1D" | "1W" | "1M" | "1Y";

const RANGE_POINTS: Record<ChartRange, number> = {
  "1D": 24,
  "1W": 28,
  "1M": 30,
  "1Y": 52,
};

/**
 * Build a deterministic price series ending at the token's current price.
 * Walks backwards from the present using the 24h change to set drift.
 */
export function getPriceHistory(symbol: string, range: ChartRange = "1M"): PricePoint[] {
  const token = TOKEN_MAP[symbol];
  if (!token) return [];
  const points = RANGE_POINTS[range];
  const rand = mulberry32(hashSeed(symbol + range));

  // stablecoins barely move
  const isStable = token.priceUsd > 0.95 && token.priceUsd < 1.05 && Math.abs(token.change24h) < 0.1;
  const vol = isStable ? 0.0008 : 0.045 + (hashSeed(symbol) % 30) / 1000;
  // overall drift so the series trends toward today's value
  const drift = (token.change24h / 100) * (range === "1D" ? 1 : range === "1W" ? 2.2 : range === "1M" ? 4 : 9);

  const series: number[] = [];
  let p = token.priceUsd / (1 + drift);
  for (let i = 0; i < points; i++) {
    const noise = (rand() - 0.5) * 2 * vol;
    const stepDrift = drift / points;
    p = p * (1 + stepDrift + noise);
    series.push(p);
  }
  // pin the last point to the real current price
  series[series.length - 1] = token.priceUsd;

  return series.map((price, i) => ({
    t: i,
    label: rangeLabel(range, i, points),
    price: Number(price.toFixed(price < 1 ? 6 : 2)),
  }));
}

function rangeLabel(range: ChartRange, i: number, points: number): string {
  if (range === "1D") return `${i}:00`;
  const daysBack = points - 1 - i;
  if (range === "1Y") return `${Math.round((daysBack / points) * 12)}mo`;
  return `${daysBack}d`;
}

// ------------------------------------------------------------------
//  Seed airdrop campaigns (admin-managed at runtime)
// ------------------------------------------------------------------

const DAY = 1000 * 60 * 60 * 24;

export function seedCampaigns(): AirdropCampaign[] {
  const now = Date.now();
  return [
    {
      id: "genesis",
      name: "Genesis Airdrop",
      description:
        "IOI's public launch airdrop. Any connected wallet can claim once.",
      tokenSymbol: "IOI",
      amountPerClaim: 250,
      totalAllocation: 1_000_000,
      claimedCount: 3187,
      eligibility: "public",
      whitelist: [],
      active: true,
      endsAt: now + 30 * DAY,
      createdAt: now - 5 * DAY,
    },
    {
      id: "early-supporter",
      name: "Early Supporter Reward",
      description:
        "A larger reward reserved for whitelisted early supporters. Add your wallet to the whitelist from the Admin panel to test claiming.",
      tokenSymbol: "IOI",
      amountPerClaim: 1000,
      totalAllocation: 500_000,
      claimedCount: 142,
      eligibility: "whitelist",
      whitelist: [],
      active: true,
      endsAt: now + 14 * DAY,
      createdAt: now - 2 * DAY,
    },
    {
      id: "lp-bonus",
      name: "Liquidity Provider Bonus",
      description:
        "Provide liquidity to the IOI/BNB pool to unlock this claim. Add a position from the Pools page first.",
      tokenSymbol: "IOI",
      amountPerClaim: 120,
      totalAllocation: 80_000,
      claimedCount: 540,
      eligibility: "lp",
      requiredPoolId: "ioi-bnb",
      whitelist: [],
      active: true,
      endsAt: now + 21 * DAY,
      createdAt: now - 1 * DAY,
    },
  ];
}

export const ADMIN_PASSWORD = "admin123";

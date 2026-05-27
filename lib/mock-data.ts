import type { Token, Pool, AirdropCampaign } from "./types";

// ------------------------------------------------------------------
//  Tokens (mock market data, EVM-style addresses)
// ------------------------------------------------------------------

export const TOKENS: Token[] = [
  {
    symbol: "ETH",
    name: "Ethereum",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    decimals: 18,
    priceUsd: 3124.55,
    change24h: 2.41,
    volume24h: 14_200_000_000,
    marketCap: 376_000_000_000,
    color: "#627eea",
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8,
    priceUsd: 64210.18,
    change24h: 1.12,
    volume24h: 5_400_000_000,
    marketCap: 14_100_000_000,
    color: "#f09242",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    priceUsd: 1.0,
    change24h: 0.01,
    volume24h: 8_900_000_000,
    marketCap: 34_000_000_000,
    color: "#2775ca",
  },
  {
    symbol: "USDT",
    name: "Tether",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    priceUsd: 1.0,
    change24h: -0.02,
    volume24h: 28_000_000_000,
    marketCap: 110_000_000_000,
    color: "#26a17b",
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
    priceUsd: 1.0,
    change24h: 0.0,
    volume24h: 420_000_000,
    marketCap: 5_300_000_000,
    color: "#f5ac37",
  },
  {
    symbol: "UNI",
    name: "Uniswap",
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    decimals: 18,
    priceUsd: 9.42,
    change24h: 4.85,
    volume24h: 210_000_000,
    marketCap: 5_650_000_000,
    color: "#ff007a",
  },
  {
    symbol: "LINK",
    name: "Chainlink",
    address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    decimals: 18,
    priceUsd: 14.27,
    change24h: -1.74,
    volume24h: 390_000_000,
    marketCap: 8_900_000_000,
    color: "#2a5ada",
  },
  {
    symbol: "ARB",
    name: "Arbitrum",
    address: "0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1",
    decimals: 18,
    priceUsd: 0.782,
    change24h: 6.32,
    volume24h: 180_000_000,
    marketCap: 3_100_000_000,
    color: "#28a0f0",
  },
  {
    symbol: "AAVE",
    name: "Aave",
    address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
    decimals: 18,
    priceUsd: 91.8,
    change24h: -2.93,
    volume24h: 150_000_000,
    marketCap: 1_360_000_000,
    color: "#b6509e",
  },
  {
    symbol: "MATIC",
    name: "Polygon",
    address: "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0",
    decimals: 18,
    priceUsd: 0.541,
    change24h: 3.17,
    volume24h: 260_000_000,
    marketCap: 5_000_000_000,
    color: "#8247e5",
  },
  {
    // The platform's native token — used for airdrops
    symbol: "IOI",
    name: "Innovate Own Inspire",
    address: "0x1010101010101010101010101010101010101010",
    decimals: 18,
    priceUsd: 1.24,
    change24h: 11.6,
    volume24h: 42_000_000,
    marketCap: 124_000_000,
    color: "#1a1aee",
  },
];

export const TOKEN_MAP: Record<string, Token> = Object.fromEntries(
  TOKENS.map((t) => [t.symbol, t]),
);

export function getToken(symbol: string): Token | undefined {
  return TOKEN_MAP[symbol];
}

// ------------------------------------------------------------------
//  Liquidity pools
// ------------------------------------------------------------------

export const POOLS: Pool[] = [
  { id: "eth-usdc", token0: "ETH", token1: "USDC", feeTier: 0.05, tvlUsd: 184_200_000, volume24h: 96_400_000, apr: 18.4 },
  { id: "wbtc-eth", token0: "WBTC", token1: "ETH", feeTier: 0.3, tvlUsd: 142_800_000, volume24h: 54_100_000, apr: 12.9 },
  { id: "eth-usdt", token0: "ETH", token1: "USDT", feeTier: 0.05, tvlUsd: 98_300_000, volume24h: 41_200_000, apr: 15.1 },
  { id: "usdc-usdt", token0: "USDC", token1: "USDT", feeTier: 0.01, tvlUsd: 76_500_000, volume24h: 120_900_000, apr: 6.2 },
  { id: "ioi-eth", token0: "IOI", token1: "ETH", feeTier: 0.3, tvlUsd: 22_400_000, volume24h: 8_900_000, apr: 64.3 },
  { id: "uni-eth", token0: "UNI", token1: "ETH", feeTier: 0.3, tvlUsd: 18_900_000, volume24h: 6_200_000, apr: 22.7 },
  { id: "link-usdc", token0: "LINK", token1: "USDC", feeTier: 0.3, tvlUsd: 12_100_000, volume24h: 3_400_000, apr: 19.8 },
  { id: "arb-eth", token0: "ARB", token1: "ETH", feeTier: 0.3, tvlUsd: 9_700_000, volume24h: 2_800_000, apr: 28.5 },
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
        "Provide liquidity to the IOI/ETH pool to unlock this claim. Add a position from the Pools page first.",
      tokenSymbol: "ARB",
      amountPerClaim: 120,
      totalAllocation: 80_000,
      claimedCount: 540,
      eligibility: "lp",
      requiredPoolId: "ioi-eth",
      whitelist: [],
      active: true,
      endsAt: now + 21 * DAY,
      createdAt: now - 1 * DAY,
    },
  ];
}

export const ADMIN_PASSWORD = "admin123";

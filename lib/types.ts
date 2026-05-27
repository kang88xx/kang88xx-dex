// Domain types for the DEX prototype (mock / no real chain)

export interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  priceUsd: number;
  change24h: number; // % change, can be negative
  volume24h: number; // USD
  marketCap: number; // USD
  color: string; // logo background color
}

export interface Pool {
  id: string;
  token0: string; // token symbol
  token1: string; // token symbol
  feeTier: number; // percent, e.g. 0.3
  tvlUsd: number;
  volume24h: number;
  apr: number; // percent
}

export type Eligibility = "public" | "whitelist" | "lp";

export interface AirdropCampaign {
  id: string;
  name: string;
  description: string;
  tokenSymbol: string;
  amountPerClaim: number;
  totalAllocation: number;
  claimedCount: number;
  eligibility: Eligibility;
  whitelist: string[]; // lower-cased addresses (used when eligibility === "whitelist")
  requiredPoolId?: string; // used when eligibility === "lp"
  active: boolean;
  endsAt: number; // epoch ms
  createdAt: number; // epoch ms
}

export type TxType = "swap" | "add-liquidity" | "remove-liquidity" | "claim";

export interface Transaction {
  id: string;
  type: TxType;
  summary: string;
  timestamp: number;
  address: string;
}

export interface LpPosition {
  poolId: string;
  amountUsd: number; // value supplied
  sharePct: number; // pool share %
}

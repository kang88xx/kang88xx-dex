import type { Token } from "./types";

// ------------------------------------------------------------------
//  BNB Smart Chain token registry (canonical contract addresses)
//
//  `priceUsd`/`change24h`/`volume24h`/`marketCap` are SEED values only —
//  shown until the first CoinGecko fetch resolves (see lib/market.ts).
//  `address: null` = native BNB. `coingeckoId: null` = not listed (IOI),
//  market data stays mock until the token launches.
// ------------------------------------------------------------------

export const TOKENS: Token[] = [
  {
    symbol: "BNB",
    name: "BNB",
    address: null, // native coin
    decimals: 18,
    coingeckoId: "binancecoin",
    priceUsd: 600,
    change24h: 0,
    volume24h: 1_800_000_000,
    marketCap: 88_000_000_000,
    color: "#f3ba2f",
  },
  {
    symbol: "USDT",
    name: "Tether",
    address: "0x55d398326f99059fF775485246999027B3197955",
    decimals: 18, // BSC-peg USDT is 18 decimals (not 6 like Ethereum)
    coingeckoId: "tether",
    priceUsd: 1.0,
    change24h: 0,
    volume24h: 28_000_000_000,
    marketCap: 110_000_000_000,
    color: "#26a17b",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    decimals: 18,
    coingeckoId: "usd-coin",
    priceUsd: 1.0,
    change24h: 0,
    volume24h: 8_900_000_000,
    marketCap: 34_000_000_000,
    color: "#2775ca",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
    decimals: 18,
    coingeckoId: "ethereum",
    priceUsd: 3100,
    change24h: 0,
    volume24h: 14_200_000_000,
    marketCap: 376_000_000_000,
    color: "#627eea",
  },
  {
    symbol: "BTCB",
    name: "Bitcoin BEP2",
    address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
    decimals: 18,
    coingeckoId: "bitcoin",
    priceUsd: 64000,
    change24h: 0,
    volume24h: 5_400_000_000,
    marketCap: 1_260_000_000_000,
    color: "#f09242",
  },
  {
    symbol: "CAKE",
    name: "PancakeSwap",
    address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    decimals: 18,
    coingeckoId: "pancakeswap-token",
    priceUsd: 2.4,
    change24h: 0,
    volume24h: 60_000_000,
    marketCap: 700_000_000,
    color: "#1fc7d4",
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
    decimals: 18,
    coingeckoId: "dai",
    priceUsd: 1.0,
    change24h: 0,
    volume24h: 420_000_000,
    marketCap: 5_300_000_000,
    color: "#f5ac37",
  },
  {
    symbol: "LINK",
    name: "Chainlink",
    address: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD",
    decimals: 18,
    coingeckoId: "chainlink",
    priceUsd: 14,
    change24h: 0,
    volume24h: 390_000_000,
    marketCap: 8_900_000_000,
    color: "#2a5ada",
  },
  {
    symbol: "XRP",
    name: "XRP",
    address: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE",
    decimals: 18,
    coingeckoId: "ripple",
    priceUsd: 0.5,
    change24h: 0,
    volume24h: 1_200_000_000,
    marketCap: 28_000_000_000,
    color: "#23292f",
  },
  {
    symbol: "DOGE",
    name: "Dogecoin",
    address: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43",
    decimals: 8, // BSC-peg DOGE keeps 8 decimals
    coingeckoId: "dogecoin",
    priceUsd: 0.12,
    change24h: 0,
    volume24h: 600_000_000,
    marketCap: 17_000_000_000,
    color: "#c2a633",
  },
  {
    // The platform's native token — not deployed yet, market data is mock
    symbol: "IOI",
    name: "Innovate Own Inspire",
    address: null,
    decimals: 18,
    coingeckoId: null,
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

/** ERC-20 tokens with a real BSC contract (for on-chain balance reads) */
export const ERC20_TOKENS = TOKENS.filter(
  (t): t is Token & { address: string } => t.address !== null,
);

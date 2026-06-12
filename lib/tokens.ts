import type { Token } from "./types";

// ------------------------------------------------------------------
//  Xphere Mainnet token registry (chainId 20250217)
//
//  `priceUsd`/`change24h`/`volume24h`/`marketCap` are SEED values only.
//  `address: null` = native XP. Nothing on Xphere has a CoinGecko feed:
//  USDX is treated as the $1 anchor (it's the ecosystem's bridged-USDT
//  stable), and every other token is priced server-side from its USDX
//  pool on OUR factory (see /api/prices). Until a token has a USDX pool
//  it shows $0 — seed one on /pools to give it a price.
//
//  Add new tokens here (or via the admin panel) as they are deployed.
// ------------------------------------------------------------------

export const TOKENS: Token[] = [
  {
    symbol: "XP",
    name: "Xphere",
    address: null, // native coin
    decimals: 18,
    coingeckoId: null,
    priceUsd: 0, // pool-priced via WXP/USDX once seeded
    change24h: 0,
    volume24h: 0,
    marketCap: 0,
    color: "#7c3aed",
    logoUrl: "/tokens/XP.svg",
    logoTransparent: true,
    logoScale: 0.8, // icon runs large — shrink 20% so corners aren't clipped
  },
  {
    // Ecosystem stable (XPBridge-bridged USDT). The app's USD anchor:
    // assumed ≈$1; every pool-priced token is quoted against it.
    symbol: "USDX",
    name: "USDX",
    address: "0xb48e189b1059e4D5C8fd154021a0516ff71a8514",
    decimals: 6, // USDX is 6 decimals (NOT 18) — per-token decimals handle this
    coingeckoId: null,
    priceUsd: 1.0,
    change24h: 0,
    volume24h: 0,
    marketCap: 0,
    color: "#26a17b",
    logoUrl: "/tokens/USDT.png", // tether-green mark fits the bridged-USDT stable
  },
  {
    // KDOGE — meme coin from the legacy Xphere deployment. Tradable once a
    // pool exists on the NEW factory (the old KDG/XP pool lives on the
    // retired factory and is not visible here).
    symbol: "KDG",
    name: "KDOGE",
    address: "0x4dE117D09842036e02F094E68086c5Dfd1132bDe",
    decimals: 18,
    coingeckoId: null,
    priceUsd: 0,
    change24h: 0,
    volume24h: 0,
    marketCap: 0,
    color: "#c2a633",
  },
];

export const TOKEN_MAP: Record<string, Token> = Object.fromEntries(
  TOKENS.map((t) => [t.symbol, t]),
);

export function getToken(symbol: string): Token | undefined {
  return TOKEN_MAP[symbol];
}

/** ERC-20 tokens with a real contract (for on-chain balance reads) */
export const ERC20_TOKENS = TOKENS.filter(
  (t): t is Token & { address: string } => t.address !== null,
);

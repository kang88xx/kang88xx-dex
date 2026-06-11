import { bsc, bscTestnet } from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";

// ------------------------------------------------------------------
//  Single source of truth for which BNB chain the app runs on.
//
//  Flip the whole app (wallet network, router, WBNB, token registry)
//  with one env var — no code change needed to go to production:
//
//    NEXT_PUBLIC_CHAIN_ENV=testnet   → BSC Testnet  (chainId 97)  [default]
//    NEXT_PUBLIC_CHAIN_ENV=mainnet   → BSC Mainnet  (chainId 56)
//
//  We default to TESTNET while testing. When ready to run live on BSC,
//  set NEXT_PUBLIC_CHAIN_ENV=mainnet in Vercel and redeploy.
// ------------------------------------------------------------------

export const IS_TESTNET =
  (process.env.NEXT_PUBLIC_CHAIN_ENV ?? "testnet") !== "mainnet";

export const ACTIVE_CHAIN: AppKitNetwork = IS_TESTNET ? bscTestnet : bsc;
export const CHAIN_ID = IS_TESTNET ? 97 : 56;
export const CHAIN_LABEL = IS_TESTNET
  ? "BNB Smart Chain Testnet"
  : "BNB Smart Chain";

// PancakeSwap V2 Router02 — different address per network.
// Env override wins so you can point at a fork/your own router if needed.
export const PANCAKE_ROUTER = (process.env.NEXT_PUBLIC_PANCAKE_ROUTER ??
  (IS_TESTNET
    ? "0xD99D1c33F9fC3444f8101754aBC46c52416550D1" // PancakeSwap V2 router (testnet)
    : "0x10ED43C718714eb63d5aA57B78B54704E256024E")) as `0x${string}`;

// Wrapped BNB — used as the intermediate hop in router paths.
export const WBNB = (process.env.NEXT_PUBLIC_WBNB ??
  (IS_TESTNET
    ? "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" // WBNB (testnet)
    : "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c")) as `0x${string}`;

// PancakeSwap V2 Factory — resolves a pair address from two token addresses
// (getPair). Used to read live reserves for real pool TVL/APR.
export const PANCAKE_FACTORY = (process.env.NEXT_PUBLIC_PANCAKE_FACTORY ??
  (IS_TESTNET
    ? "0x6725F303b657a9451d8BA641348b6761A6CC7a17" // PancakeSwap V2 factory (testnet)
    : "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73")) as `0x${string}`;

// MerkleAirdrop contract — deploy with `npm run deploy:airdrop`, then set the
// resulting address here per network. Empty = not deployed yet (on-chain
// claims disabled, admin shows "deploy first").
export const AIRDROP_CONTRACT = ((IS_TESTNET
  ? process.env.NEXT_PUBLIC_AIRDROP_TESTNET
  : process.env.NEXT_PUBLIC_AIRDROP_MAINNET) ?? "") as
  | `0x${string}`
  | "";

// KangLMS (Last Man Standing game) contract — deploy with
// `npm run deploy:lms`, then set the resulting address here per network.
// Empty = not deployed yet (the /games page runs in local demo mode).
export const LMS_CONTRACT = ((IS_TESTNET
  ? process.env.NEXT_PUBLIC_LMS_TESTNET
  : process.env.NEXT_PUBLIC_LMS_MAINNET) ?? "") as
  | `0x${string}`
  | "";

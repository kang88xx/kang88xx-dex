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

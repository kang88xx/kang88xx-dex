"use client";

import { useMemo } from "react";
import { formatUnits, parseUnits } from "viem";
import { useReadContracts } from "wagmi";
import { TOKEN_MAP } from "./tokens";

// ------------------------------------------------------------------
//  PancakeSwap V2 Router02 (BSC mainnet, canonical)
// ------------------------------------------------------------------

export const PANCAKE_ROUTER =
  "0x10ED43C718714eb63d5aA57B78B54704E256024E" as const;

export const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as const;

/** PancakeSwap V2 LP fee (0.25%) — shown in the swap details row */
export const PANCAKE_FEE = 0.0025;

export const PANCAKE_ROUTER_ABI = [
  {
    type: "function",
    name: "getAmountsOut",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "swapExactETHForTokens",
    stateMutability: "payable",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "swapExactTokensForETH",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "swapExactTokensForTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

/** A token is swappable if it has a BSC contract or is native BNB. */
export function isTradable(symbol: string): boolean {
  const t = TOKEN_MAP[symbol];
  return !!t && (t.address !== null || t.symbol === "BNB");
}

/** Registry symbol → address used in router paths (BNB → WBNB). */
function pathAddress(symbol: string): `0x${string}` | null {
  const t = TOKEN_MAP[symbol];
  if (!t) return null;
  if (t.symbol === "BNB") return WBNB;
  return t.address as `0x${string}` | null;
}

/**
 * Candidate router paths for a pair: the direct pair and (for token↔token)
 * the WBNB hop. The quote hook asks for both and keeps the better one.
 */
export function buildPaths(
  fromSymbol: string,
  toSymbol: string,
): `0x${string}`[][] {
  const a = pathAddress(fromSymbol);
  const b = pathAddress(toSymbol);
  if (!a || !b || a === b) return [];
  const paths: `0x${string}`[][] = [[a, b]];
  if (a !== WBNB && b !== WBNB) paths.push([a, WBNB, b]);
  return paths;
}

export interface SwapQuote {
  /** Best on-chain output for the entered amount (token units) */
  amountOut: number;
  amountOutWei: bigint;
  amountInWei: bigint;
  /** Router path that produced the best output */
  path: `0x${string}`[];
  isLoading: boolean;
  /** No route with liquidity exists for this pair */
  noRoute: boolean;
}

const EMPTY_QUOTE: SwapQuote = {
  amountOut: 0,
  amountOutWei: 0n,
  amountInWei: 0n,
  path: [],
  isLoading: false,
  noRoute: false,
};

/**
 * Live PancakeSwap V2 quote — re-fetched every 15s and whenever the input
 * changes. `amountIn` must be the raw input string (decimal-safe).
 */
export function useSwapQuote(
  fromSymbol: string,
  toSymbol: string,
  amountIn: string,
): SwapQuote {
  const fromToken = TOKEN_MAP[fromSymbol];
  const toToken = TOKEN_MAP[toSymbol];

  let amountInWei = 0n;
  try {
    if (fromToken && amountIn && parseFloat(amountIn) > 0) {
      amountInWei = parseUnits(amountIn, fromToken.decimals);
    }
  } catch {
    amountInWei = 0n;
  }

  const paths = useMemo(
    () => buildPaths(fromSymbol, toSymbol),
    [fromSymbol, toSymbol],
  );

  const enabled = amountInWei > 0n && paths.length > 0;

  const { data, isLoading } = useReadContracts({
    contracts: paths.map((path) => ({
      address: PANCAKE_ROUTER,
      abi: PANCAKE_ROUTER_ABI,
      functionName: "getAmountsOut" as const,
      args: [amountInWei, path] as const,
    })),
    query: { enabled, refetchInterval: 15_000 },
  });

  return useMemo(() => {
    if (!enabled) return EMPTY_QUOTE;
    if (!data) return { ...EMPTY_QUOTE, amountInWei, isLoading: true };

    let best: { out: bigint; path: `0x${string}`[] } | null = null;
    data.forEach((res, i) => {
      if (res.status !== "success") return; // pair doesn't exist → skip
      const amounts = res.result as readonly bigint[];
      const out = amounts[amounts.length - 1];
      if (!best || out > best.out) best = { out, path: paths[i] };
    });

    if (!best) {
      return { ...EMPTY_QUOTE, amountInWei, noRoute: true };
    }
    const { out, path } = best as { out: bigint; path: `0x${string}`[] };
    return {
      amountOut: Number(formatUnits(out, toToken.decimals)),
      amountOutWei: out,
      amountInWei,
      path,
      isLoading: isLoading,
      noRoute: false,
    };
  }, [enabled, data, isLoading, amountInWei, paths, toToken]);
}

/** amountOutMin after applying slippage (percent, e.g. 0.5) */
export function applySlippage(amountOutWei: bigint, slippagePct: number): bigint {
  const bps = BigInt(Math.round(slippagePct * 100)); // 0.5% → 50 bps
  return (amountOutWei * (10_000n - bps)) / 10_000n;
}

/** Swap deadline: now + 20 minutes (unix seconds) */
export function swapDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
}

"use client";

// Real on-chain liquidity for the listed pools — PancakeSwap V2 router
// add/remove liquidity plus per-pool on-chain state (pair address, reserves,
// the connected wallet's LP balance/share). Drives /pools so providing and
// withdrawing liquidity actually executes on-chain.
import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { TOKEN_MAP } from "./tokens";
import { adminTokenToToken } from "./token-registry";
import { useDexStore } from "./store";
import { WBNB, PANCAKE_FACTORY, CHAIN_ID } from "./chain";
import type { Pool, Token } from "./types";

export const LIQUIDITY_ROUTER_ABI = [
  {
    type: "function",
    name: "addLiquidity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "amountADesired", type: "uint256" },
      { name: "amountBDesired", type: "uint256" },
      { name: "amountAMin", type: "uint256" },
      { name: "amountBMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
      { name: "liquidity", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "addLiquidityETH",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amountTokenDesired", type: "uint256" },
      { name: "amountTokenMin", type: "uint256" },
      { name: "amountETHMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { name: "amountToken", type: "uint256" },
      { name: "amountETH", type: "uint256" },
      { name: "liquidity", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "removeLiquidity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "liquidity", type: "uint256" },
      { name: "amountAMin", type: "uint256" },
      { name: "amountBMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "removeLiquidityETH",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "liquidity", type: "uint256" },
      { name: "amountTokenMin", type: "uint256" },
      { name: "amountETHMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { name: "amountToken", type: "uint256" },
      { name: "amountETH", type: "uint256" },
    ],
  },
] as const;

const FACTORY_ABI = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [{ name: "pair", type: "address" }],
  },
] as const;

// The LP pair contract: reserves + standard ERC-20 (LP tokens are ERC-20).
export const PAIR_ABI = [
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "_reserve0", type: "uint112" },
      { name: "_reserve1", type: "uint112" },
      { name: "_blockTimestampLast", type: "uint32" },
    ],
  },
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/** Every known token incl. admin-added (and even delisted ones, so existing
 *  pools keep resolving). symbol → Token. */
export function useAllTokenMap(): Record<string, Token> {
  const adminTokens = useDexStore((s) => s.adminTokens);
  return useMemo(() => {
    const map: Record<string, Token> = { ...TOKEN_MAP };
    for (const a of adminTokens) {
      if (!map[a.symbol]) map[a.symbol] = adminTokenToToken(a);
    }
    return map;
  }, [adminTokens]);
}

/** Registry symbol → on-chain address (BNB trades as WBNB inside pairs). */
export function liquidityTokenAddress(
  symbol: string,
  map: Record<string, Token>,
): `0x${string}` | null {
  if (symbol === "BNB") return WBNB;
  return (map[symbol]?.address as `0x${string}` | null) ?? null;
}

export interface OnchainPool {
  pairAddress: `0x${string}` | null;
  /** Pair exists on-chain (may still have zero reserves). */
  exists: boolean;
  /** Reserves mapped to the pool's token0/token1 ordering. */
  reserveA: bigint;
  reserveB: bigint;
  totalSupply: bigint;
  /** Connected wallet's LP token balance for this pair. */
  lpBalance: bigint;
  loading: boolean;
}

const EMPTY_POOL: OnchainPool = {
  pairAddress: null,
  exists: false,
  reserveA: 0n,
  reserveB: 0n,
  totalSupply: 0n,
  lpBalance: 0n,
  loading: false,
};

/**
 * On-chain state for each listed pool: pair address (via factory), reserves
 * mapped to the pool's token order, LP total supply and the connected
 * wallet's LP balance. Refreshes every 30s.
 */
export function usePoolsOnchain(pools: Pool[]): Record<string, OnchainPool> {
  const { address: wallet } = useAccount();
  const tokenMap = useAllTokenMap();

  const entries = useMemo(
    () =>
      pools
        .map((pool) => {
          const a = liquidityTokenAddress(pool.token0, tokenMap);
          const b = liquidityTokenAddress(pool.token1, tokenMap);
          if (!a || !b || a.toLowerCase() === b.toLowerCase()) return null;
          return { pool, a, b };
        })
        .filter(
          (e): e is { pool: Pool; a: `0x${string}`; b: `0x${string}` } =>
            e !== null,
        ),
    [pools, tokenMap],
  );

  const { data: pairData } = useReadContracts({
    contracts: entries.map((e) => ({
      address: PANCAKE_FACTORY,
      abi: FACTORY_ABI,
      functionName: "getPair" as const,
      args: [e.a, e.b] as const,
      chainId: CHAIN_ID,
    })),
    query: { enabled: entries.length > 0, refetchInterval: 30_000 },
  });

  const pairAddrs = useMemo(
    () =>
      entries.map((_, i) => {
        const r = pairData?.[i];
        if (r?.status !== "success") return null;
        const addr = r.result as string;
        return addr && addr.toLowerCase() !== ZERO_ADDR
          ? (addr as `0x${string}`)
          : null;
      }),
    [entries, pairData],
  );

  // Per existing pair: reserves, token0 ordering, totalSupply, LP balance.
  const { calls, callMap, perPair } = useMemo(() => {
    const calls: {
      address: `0x${string}`;
      abi: typeof PAIR_ABI;
      functionName: "getReserves" | "token0" | "totalSupply" | "balanceOf";
      args?: readonly [`0x${string}`];
      chainId: number;
    }[] = [];
    const map: number[] = [];
    const perPair = wallet ? 4 : 3;
    entries.forEach((_, i) => {
      const pa = pairAddrs[i];
      if (!pa) return;
      map.push(i);
      calls.push({ address: pa, abi: PAIR_ABI, functionName: "getReserves", chainId: CHAIN_ID });
      calls.push({ address: pa, abi: PAIR_ABI, functionName: "token0", chainId: CHAIN_ID });
      calls.push({ address: pa, abi: PAIR_ABI, functionName: "totalSupply", chainId: CHAIN_ID });
      if (wallet)
        calls.push({ address: pa, abi: PAIR_ABI, functionName: "balanceOf", args: [wallet] as const, chainId: CHAIN_ID });
    });
    return { calls, callMap: map, perPair };
  }, [entries, pairAddrs, wallet]);

  const { data: pairState } = useReadContracts({
    contracts: calls,
    query: { enabled: calls.length > 0, refetchInterval: 30_000 },
  });

  return useMemo(() => {
    const out: Record<string, OnchainPool> = {};
    const loading =
      (entries.length > 0 && pairData === undefined) ||
      (calls.length > 0 && pairState === undefined);

    pools.forEach((p) => {
      out[p.id] = { ...EMPTY_POOL, loading };
    });

    callMap.forEach((entryIdx, k) => {
      const { pool, a } = entries[entryIdx];
      const base = k * perPair;
      const resRes = pairState?.[base];
      const t0Res = pairState?.[base + 1];
      const tsRes = pairState?.[base + 2];
      const balRes = wallet ? pairState?.[base + 3] : undefined;
      if (resRes?.status !== "success" || t0Res?.status !== "success") return;

      const [r0, r1] = resRes.result as readonly [bigint, bigint, number];
      const aIsToken0 =
        a.toLowerCase() === (t0Res.result as string).toLowerCase();
      out[pool.id] = {
        pairAddress: pairAddrs[entryIdx],
        exists: true,
        reserveA: aIsToken0 ? r0 : r1,
        reserveB: aIsToken0 ? r1 : r0,
        totalSupply:
          tsRes?.status === "success" ? (tsRes.result as bigint) : 0n,
        lpBalance:
          balRes?.status === "success" ? (balRes.result as bigint) : 0n,
        loading: false,
      };
    });

    return out;
  }, [pools, entries, callMap, perPair, pairAddrs, pairData, pairState, calls.length, wallet]);
}

/** now + 20 minutes, unix seconds — tx deadline for add/remove liquidity. */
export function liquidityDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
}

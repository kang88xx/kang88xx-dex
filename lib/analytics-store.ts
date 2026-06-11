// Server-only analytics counters — never import from client code.
//
// Storage: in-memory (per server instance) with best-effort JSON file
// persistence so the numbers survive a dev-server restart. On a read-only
// filesystem (e.g. Vercel serverless) the file write silently no-ops and the
// counters live only in memory — swap for Vercel KV / Upstash to make them
// durable + shared across instances in production.
import "server-only";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), ".data");
const FILE = join(DIR, "analytics.json");

/** A single new-wallet connection — address + unix ms of first connect. */
export interface ConnectionLog {
  address: string;
  ts: number;
}

/** A swap, attributed to a token pair, for rolling 24h per-pool volume. */
interface SwapLog {
  pair: string; // sorted symbol key, e.g. "BNB-USDT"
  usd: number;
  ts: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface Data {
  visitorsByDay: Record<string, number>;
  volumeByDay: Record<string, number>;
  // Wallet connections are counted once per wallet, all-time (new wallets
  // only). We keep a cumulative total, the dedupe set, and a log of each
  // new wallet's first connection (address + timestamp — nothing else).
  connectionsTotal: number;
  seenWallets: string[];
  connectionLog: ConnectionLog[];
  // Rolling log of swaps (pruned to the last 24h) for per-pool Fee APR.
  swapLog: SwapLog[];
  // Tx hashes already counted toward volume (replay guard), hash → unix ms.
  seenSwapTxs: Record<string, number>;
}

function empty(): Data {
  return {
    visitorsByDay: {},
    volumeByDay: {},
    connectionsTotal: 0,
    seenWallets: [],
    connectionLog: [],
    swapLog: [],
    seenSwapTxs: {},
  };
}

let cache: Data | null = null;

function load(): Data {
  if (cache) return cache;
  try {
    cache = { ...empty(), ...(JSON.parse(readFileSync(FILE, "utf8")) as Data) };
  } catch {
    cache = empty();
  }
  return cache;
}

function save(d: Data): void {
  cache = d;
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(d), "utf8");
  } catch {
    // read-only FS — keep counters in memory only
  }
}

/** KST (UTC+9, no DST) calendar date key, e.g. "2026-06-10". */
export function kstDayKey(now = Date.now()): string {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function recordVisit(): void {
  const d = load();
  const k = kstDayKey();
  d.visitorsByDay[k] = (d.visitorsByDay[k] ?? 0) + 1;
  save(d);
}

/** Counts each wallet once, all-time (new wallets only). */
export function recordConnection(address: string, now = Date.now()): void {
  const d = load();
  const addr = address.toLowerCase();
  if (d.seenWallets.includes(addr)) return;
  d.seenWallets.push(addr);
  d.connectionsTotal += 1;
  d.connectionLog.push({ address: addr, ts: now });
  save(d);
}

/** Full new-wallet connection log, newest first. */
export function connectionLog(): ConnectionLog[] {
  return [...load().connectionLog].sort((a, b) => b.ts - a.ts);
}

/** Per-day visitor counts (KST day key + count), newest day first. */
export function visitorDays(): { date: string; count: number }[] {
  const { visitorsByDay } = load();
  return Object.entries(visitorsByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

const TX_DEDUPE_MS = 7 * DAY_MS;

/**
 * Records swap volume once per tx hash. Returns false (and records nothing)
 * when the hash was already counted — the on-chain replay guard.
 */
export function recordVolume(
  usd: number,
  txHash: string,
  pair?: string,
  now = Date.now(),
): boolean {
  if (!Number.isFinite(usd) || usd <= 0) return false;
  const d = load();
  const hash = txHash.toLowerCase();
  const seen = d.seenSwapTxs ?? {};
  // Prune old hashes so the guard set stays bounded.
  for (const [h, ts] of Object.entries(seen)) {
    if (now - ts >= TX_DEDUPE_MS) delete seen[h];
  }
  if (seen[hash] !== undefined) return false;
  seen[hash] = now;
  d.seenSwapTxs = seen;
  const k = kstDayKey(now);
  d.volumeByDay[k] = (d.volumeByDay[k] ?? 0) + usd;
  if (pair) {
    // Keep only the last 24h so the rolling per-pair total stays bounded.
    d.swapLog = (d.swapLog ?? []).filter((e) => now - e.ts < DAY_MS);
    d.swapLog.push({ pair, usd, ts: now });
  }
  save(d);
  return true;
}

/** Rolling 24h swap volume (USD) per token-pair key, e.g. { "BNB-USDT": 1234 }. */
export function volume24hByPair(now = Date.now()): Record<string, number> {
  const { swapLog } = load();
  const out: Record<string, number> = {};
  (swapLog ?? []).forEach((e) => {
    if (now - e.ts >= DAY_MS) return;
    out[e.pair] = (out[e.pair] ?? 0) + e.usd;
  });
  return out;
}

export interface TodaySummary {
  day: string;
  visitors: number;
  /** Cumulative visitors across all days. */
  visitorsTotal: number;
  /** Cumulative unique-wallet connections, all-time (not today). */
  connections: number;
  volumeUsd: number;
}

export function todaySummary(): TodaySummary {
  const d = load();
  const k = kstDayKey();
  const visitorsTotal = Object.values(d.visitorsByDay).reduce(
    (sum, n) => sum + n,
    0,
  );
  return {
    day: k,
    visitors: d.visitorsByDay[k] ?? 0,
    visitorsTotal,
    connections: d.connectionsTotal,
    volumeUsd: d.volumeByDay[k] ?? 0,
  };
}

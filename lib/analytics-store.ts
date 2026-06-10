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

interface Data {
  visitorsByDay: Record<string, number>;
  connectionsByDay: Record<string, number>;
  volumeByDay: Record<string, number>;
  seenByDay: Record<string, string[]>; // wallets already counted today
}

function empty(): Data {
  return {
    visitorsByDay: {},
    connectionsByDay: {},
    volumeByDay: {},
    seenByDay: {},
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

/** Counts each wallet once per KST day. */
export function recordConnection(address: string): void {
  const d = load();
  const k = kstDayKey();
  const addr = address.toLowerCase();
  const seen = d.seenByDay[k] ?? (d.seenByDay[k] = []);
  if (seen.includes(addr)) return;
  seen.push(addr);
  d.connectionsByDay[k] = (d.connectionsByDay[k] ?? 0) + 1;
  save(d);
}

export function recordVolume(usd: number): void {
  if (!Number.isFinite(usd) || usd <= 0) return;
  const d = load();
  const k = kstDayKey();
  d.volumeByDay[k] = (d.volumeByDay[k] ?? 0) + usd;
  save(d);
}

export interface TodaySummary {
  day: string;
  visitors: number;
  connections: number;
  volumeUsd: number;
}

export function todaySummary(): TodaySummary {
  const d = load();
  const k = kstDayKey();
  return {
    day: k,
    visitors: d.visitorsByDay[k] ?? 0,
    connections: d.connectionsByDay[k] ?? 0,
    volumeUsd: d.volumeByDay[k] ?? 0,
  };
}

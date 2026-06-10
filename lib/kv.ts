// Tiny key-value adapter, server-only. Uses Upstash Redis (REST) in
// production; falls back to a local JSON file for dev when Upstash env isn't
// set. Upstash REST works on Vercel's serverless/Fluid runtime where the
// filesystem is ephemeral, so shared state (campaigns) survives there.
//
// Set in production (Vercel → Storage → Upstash, or env):
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
import "server-only";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/** True when a shared (Upstash) store is configured — else file fallback. */
export const kvShared = !!(REST_URL && REST_TOKEN);

const DIR = join(process.cwd(), ".data");
const filePath = (key: string) =>
  join(DIR, `kv-${key.replace(/[^a-z0-9]/gi, "_")}.json`);

async function command<T>(args: string[]): Promise<T> {
  const res = await fetch(REST_URL as string, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const json = (await res.json()) as { result: T };
  return json.result;
}

export async function kvGet(key: string): Promise<string | null> {
  if (kvShared) return (await command<string | null>(["GET", key])) ?? null;
  try {
    return readFileSync(filePath(key), "utf8");
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (kvShared) {
    await command(["SET", key, value]);
    return;
  }
  // File fallback (local dev). On a read-only/ephemeral FS (Vercel without
  // Upstash) this can't persist — configure Upstash for shared production state.
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(filePath(key), value, "utf8");
  } catch {
    // no-op: not durable without Upstash
  }
}

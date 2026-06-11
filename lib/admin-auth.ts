// Server-only admin session helpers — never import from client code.
import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "ioi_admin_session";
export const SESSION_TTL_S = 60 * 60 * 24; // 24h

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? "";
}

/** True when both ADMIN_PASSWORD and ADMIN_SESSION_SECRET are set. */
export function adminConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD && !!secret();
}

/**
 * Session-signing key derived from BOTH the session secret and the admin
 * password. Rotating either env var (then redeploying) invalidates every
 * outstanding session at once — the revocation story for stateless tokens.
 */
function signingKey(): Buffer {
  return createHmac("sha256", secret())
    .update(`session-key|${process.env.ADMIN_PASSWORD ?? ""}`)
    .digest();
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("hex");
}

/** Constant-time string comparison via SHA-256 digests (equal length). */
function safeEqual(a: string, b: string): boolean {
  const da = createHash("sha256").update(a).digest();
  const db = createHash("sha256").update(b).digest();
  return timingSafeEqual(da, db);
}

/**
 * Client IP for rate limiting. x-real-ip is set by the platform (Vercel) and
 * can't be spoofed; fallback is the LAST x-forwarded-for entry — proxies
 * append the real peer IP, so the first entry is client-controlled but the
 * last isn't.
 */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = req.headers.get("x-forwarded-for")?.split(",") ?? [];
  return fwd.at(-1)?.trim() || "local";
}

export function verifyPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !password) return false;
  return safeEqual(password, expected);
}

/** Stateless HMAC session token: "<expiresAtMs>.<signature>" */
export function createSessionToken(): string {
  const expires = String(Date.now() + SESSION_TTL_S * 1000);
  return `${expires}.${sign(expires)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token || !secret()) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expires = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  return safeEqual(sign(expires), sig);
}

// ─── Naive in-memory rate limit (per server instance) ───────────────────────
// Good enough to blunt brute force on a single node; swap for a shared store
// (Redis/Upstash) when running multiple instances.

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function rateLimitLogin(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

export function clearRateLimit(ip: string): void {
  attempts.delete(ip);
}

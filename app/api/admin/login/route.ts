import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminConfigured,
  clearRateLimit,
  createSessionToken,
  rateLimitLogin,
  SESSION_TTL_S,
  verifyPassword,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  // x-real-ip is set by the platform (Vercel) and can't be spoofed by the
  // client. Fall back to the LAST x-forwarded-for entry — proxies append the
  // real peer IP, so the first entry is client-controlled but the last isn't.
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = req.headers.get("x-forwarded-for")?.split(",") ?? [];
  return fwd.at(-1)?.trim() || "local";
}

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Admin login is not configured on this server" },
      { status: 503 },
    );
  }

  const ip = clientIp(req);
  if (!rateLimitLogin(ip)) {
    return NextResponse.json(
      { error: "Too many attempts — try again in 10 minutes" },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    password?: string;
  } | null;

  if (!body?.password || !verifyPassword(body.password)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  clearRateLimit(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
  return res;
}

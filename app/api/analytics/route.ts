import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-auth";
import {
  recordVisit,
  recordConnection,
  recordVolume,
  todaySummary,
} from "@/lib/analytics-store";

export const dynamic = "force-dynamic";

// Ingest a single event. Public — any visitor reports their own page view /
// wallet connect / completed swap. Counters are deduped server-side.
export async function POST(req: Request) {
  let body: { event?: string; address?: string; volumeUsd?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty / malformed body → falls through to 400 below
  }

  switch (body.event) {
    case "visit":
      recordVisit();
      break;
    case "connect":
      if (
        typeof body.address === "string" &&
        /^0x[a-fA-F0-9]{40}$/.test(body.address)
      ) {
        recordConnection(body.address);
      }
      break;
    case "swap":
      if (typeof body.volumeUsd === "number") recordVolume(body.volumeUsd);
      break;
    default:
      return NextResponse.json(
        { ok: false, error: "unknown event" },
        { status: 400 },
      );
  }
  return NextResponse.json({ ok: true });
}

// Today's KST summary — admin only.
export async function GET() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(todaySummary());
}

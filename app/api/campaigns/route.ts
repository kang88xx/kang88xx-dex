import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-auth";
import { readCampaigns, writeCampaigns } from "@/lib/campaign-store";
import type { AirdropCampaign } from "@/lib/types";

export const dynamic = "force-dynamic";

// Public: the shared campaign list (anyone can read to see/claim airdrops).
export async function GET() {
  const list = await readCampaigns();
  return NextResponse.json(list, { headers: { "cache-control": "no-store" } });
}

// Admin only: replace the whole campaign list (the admin client computes the
// next state and PUTs it). Cookie-authenticated like the analytics summary.
export async function PUT(req: Request) {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "expected an array" }, { status: 400 });
  }
  for (const c of body) {
    if (
      !c ||
      typeof c !== "object" ||
      typeof (c as { id?: unknown }).id !== "string"
    ) {
      return NextResponse.json(
        { error: "invalid campaign in list" },
        { status: 400 },
      );
    }
  }

  await writeCampaigns(body as AirdropCampaign[]);
  return NextResponse.json({ ok: true });
}

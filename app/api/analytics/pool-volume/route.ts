import { NextResponse } from "next/server";
import { volume24hByPair } from "@/lib/analytics-store";

export const dynamic = "force-dynamic";

// Public: rolling 24h swap volume (USD) per token-pair key, e.g.
// { "BNB-USDT": 1234.5 }. Used by the Pools page to compute live Fee APR.
// Aggregate, non-sensitive — safe to expose without admin auth.
export async function GET() {
  return NextResponse.json(volume24hByPair(), {
    headers: { "cache-control": "no-store" },
  });
}

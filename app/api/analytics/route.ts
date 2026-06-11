import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-auth";
import {
  recordVisit,
  recordConnection,
  recordVolume,
  todaySummary,
} from "@/lib/analytics-store";
import { PANCAKE_ROUTER } from "@/lib/chain";
import { serverRpc } from "@/lib/server-rpc";

export const dynamic = "force-dynamic";

// Single-swap sanity ceiling — a report above this is noise or abuse.
const MAX_SWAP_USD = 1_000_000;

/** The tx must exist, have succeeded, and have been sent to our router. */
async function isRouterSwap(txHash: `0x${string}`): Promise<boolean> {
  try {
    const receipt = await serverRpc().getTransactionReceipt({ hash: txHash });
    return (
      receipt.status === "success" &&
      (receipt.to ?? "").toLowerCase() === PANCAKE_ROUTER.toLowerCase()
    );
  } catch {
    return false; // not found / RPC failure → fail closed
  }
}

// Ingest a single event. Public — any visitor reports their own page view /
// wallet connect / completed swap. Counters are deduped server-side; swap
// volume is only counted for a verified, unseen on-chain router tx.
export async function POST(req: Request) {
  let body: {
    event?: string;
    address?: string;
    volumeUsd?: number;
    pair?: string;
    txHash?: string;
  } = {};
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
    case "swap": {
      const { volumeUsd, txHash } = body;
      if (
        typeof volumeUsd !== "number" ||
        !Number.isFinite(volumeUsd) ||
        volumeUsd <= 0 ||
        volumeUsd > MAX_SWAP_USD ||
        typeof txHash !== "string" ||
        !/^0x[a-fA-F0-9]{64}$/.test(txHash)
      ) {
        return NextResponse.json(
          { ok: false, error: "invalid swap report" },
          { status: 400 },
        );
      }
      if (!(await isRouterSwap(txHash as `0x${string}`))) {
        return NextResponse.json(
          { ok: false, error: "unverified swap" },
          { status: 422 },
        );
      }
      const pair =
        typeof body.pair === "string" && /^[A-Z0-9]+-[A-Z0-9]+$/.test(body.pair)
          ? body.pair
          : undefined;
      recordVolume(volumeUsd, txHash, pair);
      break;
    }
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

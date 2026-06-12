// Bridge relayer — the trusted half of the testnet lock/release bridge.
//
// POST { srcChainId, txHash }: the client locked USDT in the source-chain
// TestBridge and hands us the tx hash. We verify EVERYTHING on-chain
// ourselves (never trust the client): the receipt must be a successful tx
// that emitted BridgeOut from OUR bridge contract, the payout amount and
// recipient come from that event, and the destination contract's
// processed-mapping makes every transferId pay out at most once — even if
// the same hash is resubmitted or two requests race (the second release
// reverts on-chain).
import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  encodeAbiParameters,
  parseEventLogs,
  formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet, opBNBTestnet } from "viem/chains";
import {
  BRIDGE_ENABLED,
  BRIDGE_SIDES,
  BRIDGE_TOKEN_DECIMALS,
  BSC_TESTNET_ID,
  OPBNB_TESTNET_ID,
  TEST_BRIDGE_ABI,
  otherSide,
} from "@/lib/bridge";

export const dynamic = "force-dynamic";

const VIEM_CHAINS = {
  [BSC_TESTNET_ID]: bscTestnet,
  [OPBNB_TESTNET_ID]: opBNBTestnet,
} as const;

/** In-flight transferIds — politeness guard against double-submit races
 *  (the on-chain processed mapping is the real safety net). */
const inflight = new Set<string>();

function err(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  if (!BRIDGE_ENABLED) return err("bridge not configured", 503);

  const relayerKey = process.env.BRIDGE_RELAYER_PRIVATE_KEY;
  if (!relayerKey || !/^0x[0-9a-fA-F]{64}$/.test(relayerKey))
    return err("relayer key not configured", 503);

  let body: { srcChainId?: number; txHash?: string };
  try {
    body = await req.json();
  } catch {
    return err("invalid JSON");
  }

  const srcChainId = Number(body.srcChainId);
  const txHash = body.txHash ?? "";
  if (srcChainId !== BSC_TESTNET_ID && srcChainId !== OPBNB_TESTNET_ID)
    return err("unsupported source chain");
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return err("invalid tx hash");

  const src = BRIDGE_SIDES[srcChainId];
  const dst = otherSide(srcChainId);

  // --- 1. Verify the lock tx on the SOURCE chain -------------------------
  const srcClient = createPublicClient({
    chain: VIEM_CHAINS[srcChainId as keyof typeof VIEM_CHAINS],
    transport: http(src.rpc),
  });

  let receipt;
  try {
    receipt = await srcClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
  } catch {
    return err("source tx not found (not mined yet?)", 404);
  }
  if (receipt.status !== "success") return err("source tx reverted");

  // The BridgeOut event must come from OUR bridge contract.
  const events = parseEventLogs({
    abi: TEST_BRIDGE_ABI,
    eventName: "BridgeOut",
    logs: receipt.logs,
  }).filter((l) => l.address.toLowerCase() === src.bridge.toLowerCase());
  if (events.length === 0) return err("no BridgeOut event from our bridge");

  const ev = events[0];
  const { from, amount, dstChainId } = ev.args;
  if (Number(dstChainId) !== dst.chainId)
    return err("event destination chain mismatch");

  // Unique id per source event — (srcChain, txHash, logIndex).
  const transferId = keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "bytes32" }, { type: "uint256" }],
      [BigInt(srcChainId), txHash as `0x${string}`, BigInt(ev.logIndex)],
    ),
  );

  if (inflight.has(transferId)) return err("transfer already in flight", 409);
  inflight.add(transferId);
  try {
    // --- 2. Release from reserves on the DESTINATION chain ---------------
    const dstChain = VIEM_CHAINS[dst.chainId as keyof typeof VIEM_CHAINS];
    const dstPublic = createPublicClient({
      chain: dstChain,
      transport: http(dst.rpc),
    });

    const already = await dstPublic.readContract({
      address: dst.bridge as `0x${string}`,
      abi: TEST_BRIDGE_ABI,
      functionName: "processed",
      args: [transferId],
    });
    if (already)
      return NextResponse.json({ ok: true, alreadyProcessed: true });

    const reserve = await dstPublic.readContract({
      address: dst.bridge as `0x${string}`,
      abi: TEST_BRIDGE_ABI,
      functionName: "reserve",
    });
    if (reserve < amount)
      return err(
        `destination reserve too low (${formatUnits(reserve, BRIDGE_TOKEN_DECIMALS)} USDT available)`,
        503,
      );

    const account = privateKeyToAccount(relayerKey as `0x${string}`);
    const dstWallet = createWalletClient({
      account,
      chain: dstChain,
      transport: http(dst.rpc),
    });

    // Simulate first for a clean revert reason, then send.
    const { request } = await dstPublic.simulateContract({
      account,
      address: dst.bridge as `0x${string}`,
      abi: TEST_BRIDGE_ABI,
      functionName: "release",
      args: [transferId, from, amount],
    });
    const dstTxHash = await dstWallet.writeContract(request);
    const dstReceipt = await dstPublic.waitForTransactionReceipt({
      hash: dstTxHash,
    });
    if (dstReceipt.status !== "success")
      return err("release tx reverted on destination", 502);

    return NextResponse.json({
      ok: true,
      dstChainId: dst.chainId,
      dstTxHash,
      amount: amount.toString(),
      to: from,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "relay failed";
    // A race that lost to another release shows up as a revert — report it
    // as already processed rather than a scary error.
    if (msg.includes("processed"))
      return NextResponse.json({ ok: true, alreadyProcessed: true });
    return err(msg.slice(0, 300), 502);
  } finally {
    inflight.delete(transferId);
  }
}

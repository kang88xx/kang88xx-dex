// Server-only viem public client for the active BNB chain — used by API
// routes that must verify on-chain facts themselves (never trust the client).
import "server-only";
import { createPublicClient, http, type PublicClient } from "viem";
import { bsc, bscTestnet } from "viem/chains";
import { IS_TESTNET } from "./chain";

const RPC_URL =
  process.env.BSC_RPC ??
  (IS_TESTNET
    ? "https://data-seed-prebsc-1-s1.bnbchain.org:8545"
    : "https://bsc-dataseed.bnbchain.org");

let client: PublicClient | null = null;

export function serverRpc(): PublicClient {
  if (!client) {
    client = createPublicClient({
      chain: IS_TESTNET ? bscTestnet : bsc,
      transport: http(RPC_URL),
    });
  }
  return client;
}

// Deploy a TestToken (ERC-20) to BSC TESTNET — one command, you sign with your key.
//
//   1. Fund your wallet with test BNB:  https://testnet.bnbchain.org/faucet-smart
//   2. Put a TESTNET-ONLY private key + token params in .env.deploy (gitignored):
//        DEPLOYER_PRIVATE_KEY=0xabc...        # throwaway testnet key ONLY
//        TOKEN_NAME=Test Tether
//        TOKEN_SYMBOL=USDT
//        TOKEN_SUPPLY=1000000                  # whole tokens minted to you
//   3. Run:  npm run deploy:token
//
// Deploy another token (e.g. a meme coin) by changing TOKEN_* and re-running.
//
// SAFETY: never put a mainnet key or a key holding real funds in .env.deploy.
// This script refuses to run on mainnet (chainId 56).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createWalletClient,
  createPublicClient,
  http,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- load .env.deploy (simple parser, no dependency) ---
function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, "..", ".env.deploy"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env.deploy — fall back to process env
  }
}
loadEnv();

const PK = process.env.DEPLOYER_PRIVATE_KEY;
const NAME = process.env.TOKEN_NAME ?? "Test Tether";
const SYMBOL = process.env.TOKEN_SYMBOL ?? "USDT";
const SUPPLY = BigInt(process.env.TOKEN_SUPPLY ?? "1000000");
const RPC =
  process.env.BSC_TESTNET_RPC ?? "https://data-seed-prebsc-1-s1.bnbchain.org:8545";

if (!PK || !/^0x[0-9a-fA-F]{64}$/.test(PK)) {
  console.error(
    "✗ DEPLOYER_PRIVATE_KEY missing/invalid. Add a TESTNET-ONLY key to .env.deploy.",
  );
  process.exit(1);
}

const artifact = JSON.parse(
  readFileSync(join(__dirname, "..", "contracts", "TestToken.artifact.json"), "utf8"),
);

const account = privateKeyToAccount(PK);
const transport = http(RPC);
const publicClient = createPublicClient({ chain: bscTestnet, transport });
const walletClient = createWalletClient({ account, chain: bscTestnet, transport });

console.log("Network    : BSC Testnet (chainId 97)");
console.log("Deployer   :", account.address);
console.log(`Token      : ${NAME} (${SYMBOL}), supply ${SUPPLY} → you, 18 decimals`);

const bal = await publicClient.getBalance({ address: account.address });
console.log("Balance    :", formatEther(bal), "tBNB");
if (bal === 0n) {
  console.error(
    "✗ 0 tBNB — fund the deployer first: https://testnet.bnbchain.org/faucet-smart",
  );
  process.exit(1);
}

console.log("\nDeploying…");
const hash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  args: [NAME, SYMBOL, SUPPLY],
});
console.log("Tx         :", hash);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) {
  console.error("✗ Deployment failed:", receipt.status);
  process.exit(1);
}

console.log("\n✓ Deployed!");
console.log("Contract   :", receipt.contractAddress);
console.log("Explorer   : https://testnet.bscscan.com/address/" + receipt.contractAddress);
console.log("\nNext steps:");
console.log(`  • Add it in the DEX admin (/admin → Add swap token): symbol ${SYMBOL}, decimals 18`);
if (SYMBOL === "USDT") {
  console.log(`  • or set NEXT_PUBLIC_TUSDT_ADDRESS=${receipt.contractAddress} (+ on Vercel)`);
}
console.log("  • Create a PancakeSwap testnet pool so swaps have a route (see TESTNET.md)");

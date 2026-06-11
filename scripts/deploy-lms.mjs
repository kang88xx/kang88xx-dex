// Deploy KangLMS (Last Man Standing game) to BSC TESTNET — one command.
//
//   1. Fund your wallet with test BNB:  https://testnet.bnbchain.org/faucet-smart
//   2. Put a TESTNET-ONLY private key in .env.deploy (gitignored):
//        DEPLOYER_PRIVATE_KEY=0xabc...        # throwaway testnet key ONLY
//   3. Compile (once):  node scripts/compile-contract.mjs KangLMS
//   4. Deploy:          npm run deploy:lms
//
// Constructor wiring (overridable via env in .env.deploy):
//   LMS_TOKEN     — bet token        (default: KANG testnet)
//   LMS_TREASURY  — treasury wallet  (default: the fee wallet shown on /games)
//   LMS_BURN      — burn wallet      (default: the burn wallet shown on /games)
//
// The deployer becomes the contract owner (config/pause/withdraw-excess).
// SAFETY: never put a mainnet key or a key holding real funds here.
// This script refuses to run on mainnet (chainId 56).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createWalletClient, createPublicClient, http, formatEther, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
const RPC =
  process.env.BSC_TESTNET_RPC ?? "https://data-seed-prebsc-1-s1.bnbchain.org:8545";

// KANG (testnet) + the fee wallets already displayed on /games.
const TOKEN = process.env.LMS_TOKEN ?? "0x95523061Fb69F8EDaF28Fa07f371BfB565362fE2";
const TREASURY = process.env.LMS_TREASURY ?? "0x44414D1Ff9e4aFC08503CEDBb43Ab6ef201acb91";
const BURN = process.env.LMS_BURN ?? "0x2c151C3FD184045396D4339426a77E367A684Af1";

if (!PK || !/^0x[0-9a-fA-F]{64}$/.test(PK)) {
  console.error(
    "✗ DEPLOYER_PRIVATE_KEY missing/invalid. Add a TESTNET-ONLY key to .env.deploy.",
  );
  process.exit(1);
}
for (const [label, addr] of [["LMS_TOKEN", TOKEN], ["LMS_TREASURY", TREASURY], ["LMS_BURN", BURN]]) {
  if (!isAddress(addr)) {
    console.error(`✗ ${label} is not a valid address: ${addr}`);
    process.exit(1);
  }
}

const artifact = JSON.parse(
  readFileSync(join(__dirname, "..", "contracts", "KangLMS.artifact.json"), "utf8"),
);

const account = privateKeyToAccount(PK);
const transport = http(RPC);
const publicClient = createPublicClient({ chain: bscTestnet, transport });
const walletClient = createWalletClient({ account, chain: bscTestnet, transport });

console.log("Network    : BSC Testnet (chainId 97)");
console.log("Deployer   :", account.address, "(becomes contract owner)");
console.log("Bet token  :", TOKEN);
console.log("Treasury   :", TREASURY);
console.log("Burn wallet:", BURN);

const bal = await publicClient.getBalance({ address: account.address });
console.log("Balance    :", formatEther(bal), "tBNB");
if (bal === 0n) {
  console.error(
    "✗ 0 tBNB — fund the deployer first: https://testnet.bnbchain.org/faucet-smart",
  );
  process.exit(1);
}

console.log("\nDeploying KangLMS…");
const hash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  args: [TOKEN, TREASURY, BURN],
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
console.log("\nNext step:");
console.log(`  • Set NEXT_PUBLIC_LMS_TESTNET=${receipt.contractAddress} in .env.local`);
console.log("    (and on Vercel for the deployed app), then restart the dev server.");

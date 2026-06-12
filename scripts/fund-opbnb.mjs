// Bridge tBNB from BSC Testnet → opBNB Testnet for the deployer wallet, so
// it can pay gas to deploy/relay on opBNB. Uses the official opBNB canonical
// bridge: a plain BNB transfer to the OptimismPortal proxy mints the same
// amount to the sender's address on L2 (standard OP-stack deposit).
//
//   FUND_AMOUNT=0.3 npm run fund:opbnb     (default 0.3 tBNB)
//
// Addresses from the official docs:
// https://docs.bnbchain.org/bnb-opbnb/core-concepts/opbnb-protocol-addresses/
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet, opBNBTestnet } from "viem/chains";

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

// opBNB Testnet OptimismPortal proxy on BSC Testnet (L1).
const OPTIMISM_PORTAL = "0x4386C8ABf2009aC0c263462Da568DD9d46e52a31";

const PK = process.env.DEPLOYER_PRIVATE_KEY;
const AMOUNT = process.env.FUND_AMOUNT ?? "0.3";
if (!PK || !/^0x[0-9a-fA-F]{64}$/.test(PK)) {
  console.error("✗ DEPLOYER_PRIVATE_KEY missing/invalid in .env.deploy");
  process.exit(1);
}

const account = privateKeyToAccount(PK);
const l1 = createPublicClient({ chain: bscTestnet, transport: http() });
const l1Wallet = createWalletClient({ account, chain: bscTestnet, transport: http() });
const l2 = createPublicClient({ chain: opBNBTestnet, transport: http() });

const [l1Bal, l2Before] = await Promise.all([
  l1.getBalance({ address: account.address }),
  l2.getBalance({ address: account.address }),
]);
console.log("Wallet     :", account.address);
console.log("BSC testnet:", formatEther(l1Bal), "tBNB");
console.log("opBNB      :", formatEther(l2Before), "tBNB");
console.log(`\nDepositing ${AMOUNT} tBNB → opBNB Testnet via OptimismPortal…`);

const value = parseEther(AMOUNT);
if (l1Bal <= value) {
  console.error("✗ not enough tBNB on BSC testnet");
  process.exit(1);
}

const hash = await l1Wallet.sendTransaction({
  to: OPTIMISM_PORTAL,
  value,
  // OP-stack portals take a plain transfer; gas estimation needs headroom
  // for the deposit event. viem estimates this fine on BSC testnet.
});
console.log("L1 tx      :", hash);
const receipt = await l1.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") {
  console.error("✗ deposit tx reverted");
  process.exit(1);
}
console.log("✓ deposit confirmed on BSC testnet — waiting for L2 arrival…");

// Poll opBNB until the balance grows (usually 1–3 minutes).
const deadline = Date.now() + 10 * 60 * 1000;
for (;;) {
  await new Promise((r) => setTimeout(r, 15_000));
  const bal = await l2.getBalance({ address: account.address });
  process.stdout.write(`  opBNB balance: ${formatEther(bal)} tBNB\r`);
  if (bal > l2Before) {
    console.log(`\n✓ arrived! opBNB balance: ${formatEther(bal)} tBNB`);
    break;
  }
  if (Date.now() > deadline) {
    console.log(
      "\n⚠ still pending after 10 min — check later: " +
        `https://testnet.opbnbscan.com/address/${account.address}`,
    );
    break;
  }
}

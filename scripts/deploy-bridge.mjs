// Deploy the testnet USDT bridge: BSC Testnet (97) ↔ opBNB Testnet (5611).
//
// One command does all of it, idempotently driven by env overrides:
//   1. Deploys TestToken USDT on opBNB Testnet (skip: set OPBNB_USDT=0x…)
//   2. Deploys TestBridge on both chains (token + relayer wired in)
//   3. Funds both bridges with USDT reserves — the deployer key owns the
//      TestToken on both chains, so it owner-mints BRIDGE_RESERVE straight
//      to each bridge (no USDT balance needed)
//   4. Prints the env lines to paste into .env.local / Vercel
//
//   npm run deploy:bridge
//
// Prereqs:
//   • .env.deploy has DEPLOYER_PRIVATE_KEY (testnet-only key)
//   • deployer has tBNB gas on BOTH chains — run `npm run fund:opbnb` first
//   • compile artifacts exist: npm run compile:bridge (TestToken's is in repo)
//
// Env knobs: OPBNB_USDT, RELAYER_ADDRESS (default deployer), BRIDGE_RESERVE
// (whole USDT per side, default 10000), BSC_USDT (default from .env.local).
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
import { bscTestnet, opBNBTestnet } from "viem/chains";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- load .env.deploy and .env.local (simple parser, no dependency) ---
function loadEnv(file) {
  try {
    const raw = readFileSync(join(__dirname, "..", file), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // missing file is fine
  }
}
loadEnv(".env.deploy");
loadEnv(".env.local");

const PK = process.env.DEPLOYER_PRIVATE_KEY;
if (!PK || !/^0x[0-9a-fA-F]{64}$/.test(PK)) {
  console.error("✗ DEPLOYER_PRIVATE_KEY missing/invalid in .env.deploy");
  process.exit(1);
}
const account = privateKeyToAccount(PK);
const RELAYER = process.env.RELAYER_ADDRESS ?? account.address;
const RESERVE = BigInt(process.env.BRIDGE_RESERVE ?? "10000"); // whole USDT
const BSC_USDT = process.env.BSC_USDT ?? process.env.NEXT_PUBLIC_TUSDT_ADDRESS;
if (!BSC_USDT) {
  console.error("✗ BSC-side USDT unknown — set NEXT_PUBLIC_TUSDT_ADDRESS in .env.local");
  process.exit(1);
}

const tokenArtifact = JSON.parse(
  readFileSync(join(__dirname, "..", "contracts", "TestToken.artifact.json"), "utf8"),
);
const bridgeArtifact = JSON.parse(
  readFileSync(join(__dirname, "..", "contracts", "TestBridge.artifact.json"), "utf8"),
);

const CHAINS = {
  bsc: { chain: bscTestnet, label: "BSC Testnet", explorer: "https://testnet.bscscan.com" },
  opbnb: { chain: opBNBTestnet, label: "opBNB Testnet", explorer: "https://testnet.opbnbscan.com" },
};
const clients = Object.fromEntries(
  Object.entries(CHAINS).map(([k, { chain }]) => [
    k,
    {
      pub: createPublicClient({ chain, transport: http() }),
      wallet: createWalletClient({ account, chain, transport: http() }),
    },
  ]),
);

console.log("Deployer :", account.address);
console.log("Relayer  :", RELAYER);
console.log("Reserve  :", RESERVE.toString(), "USDT per side\n");

// --- gas check on both chains -------------------------------------------
for (const [k, { label }] of Object.entries(CHAINS)) {
  const bal = await clients[k].pub.getBalance({ address: account.address });
  console.log(`${label.padEnd(14)}: ${formatEther(bal)} tBNB`);
  if (bal === 0n) {
    console.error(
      k === "opbnb"
        ? "✗ no gas on opBNB Testnet — run `npm run fund:opbnb` first"
        : "✗ no gas on BSC Testnet — use the faucet",
    );
    process.exit(1);
  }
}

async function deploy(key, abi, bytecode, args, what) {
  const { pub, wallet } = clients[key];
  console.log(`\nDeploying ${what} on ${CHAINS[key].label}…`);
  const hash = await wallet.deployContract({ abi, bytecode, args });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress)
    throw new Error(`${what} deployment failed on ${CHAINS[key].label}`);
  console.log(`✓ ${what}: ${receipt.contractAddress}`);
  console.log(`  ${CHAINS[key].explorer}/address/${receipt.contractAddress}`);
  return receipt.contractAddress;
}

async function write(key, what, params) {
  const { pub, wallet } = clients[key];
  const hash = await wallet.writeContract(params);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success")
    throw new Error(`${what} failed on ${CHAINS[key].label}`);
  console.log(`✓ ${what}`);
}

// --- 1. USDT on opBNB ------------------------------------------------------
let opbnbUsdt = process.env.OPBNB_USDT;
if (opbnbUsdt) {
  console.log(`\nopBNB USDT (existing): ${opbnbUsdt}`);
} else {
  opbnbUsdt = await deploy(
    "opbnb",
    tokenArtifact.abi,
    tokenArtifact.bytecode,
    ["Test Tether", "USDT", 1_000_000n],
    "TestToken USDT",
  );
}

// --- 2. bridges on both chains --------------------------------------------
const bscBridge = await deploy(
  "bsc",
  bridgeArtifact.abi,
  bridgeArtifact.bytecode,
  [BSC_USDT, RELAYER],
  "TestBridge",
);
const opbnbBridge = await deploy(
  "opbnb",
  bridgeArtifact.abi,
  bridgeArtifact.bytecode,
  [opbnbUsdt, RELAYER],
  "TestBridge",
);

// --- 3. fund reserves (owner-mint on both chains) ---------------------------
console.log("");
await write("bsc", `fund BSC bridge with ${RESERVE} USDT (mint)`, {
  address: BSC_USDT,
  abi: tokenArtifact.abi,
  functionName: "mint",
  args: [bscBridge, RESERVE],
});
await write("opbnb", `fund opBNB bridge with ${RESERVE} USDT (mint)`, {
  address: opbnbUsdt,
  abi: tokenArtifact.abi,
  functionName: "mint",
  args: [opbnbBridge, RESERVE],
});

// --- 4. env summary ---------------------------------------------------------
console.log(`
✓ All done! Paste into .env.local (+ Vercel for deploys):

NEXT_PUBLIC_BRIDGE_TESTNET_BSC=${bscBridge}
NEXT_PUBLIC_BRIDGE_TESTNET_OPBNB=${opbnbBridge}
NEXT_PUBLIC_TUSDT_OPBNB_ADDRESS=${opbnbUsdt}
BRIDGE_RELAYER_PRIVATE_KEY=<the private key for ${RELAYER}>

Then restart \`npm run dev\` and open /bridge.`);

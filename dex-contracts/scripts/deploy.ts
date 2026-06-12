/**
 * Deploys the Xphere DEX:
 *   1. WXP   (WETH9 wrapper, labeled WXP)
 *   2. UniswapV2Factory(feeToSetter = deployer)
 *   3. UniswapV2Router02(factory, WXP)
 *
 * Writes all addresses + the on-chain init code hash to
 * deployments/<network>.json and logs them.
 *
 *   npm run deploy           (network: xphere)
 *   npm run deploy:local     (network: hardhat)
 *
 * IMPORTANT: before deploying the Router, make sure UniswapV2Library's
 * INIT_CODE_PAIR_HASH matches this build (run `npm run hash`). This script
 * checks it and ABORTS if they differ, so you can't ship a broken Router.
 */
import { ethers, network, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  console.log(`Network : ${network.name}`);
  console.log(`Deployer: ${deployerAddr}`);

  // --- Safety: verify the library init hash matches this Pair build ---
  const pairArtifact = await artifacts.readArtifact("UniswapV2Pair");
  const computedHash = ethers.keccak256(pairArtifact.bytecode);

  const libPath = path.join(
    __dirname,
    "..",
    "contracts",
    "periphery",
    "libraries",
    "UniswapV2Library.sol",
  );
  const libSrc = fs.readFileSync(libPath, "utf8");
  const m = libSrc.match(/INIT_CODE_PAIR_HASH\s*=\s*hex'([0-9a-fA-F]+)'/);
  const librarycHash = m ? "0x" + m[1] : "(not found)";

  console.log(`Init code hash (computed): ${computedHash}`);
  console.log(`Init code hash (library) : ${librarycHash}`);
  if (librarycHash.toLowerCase() !== computedHash.toLowerCase()) {
    throw new Error(
      "INIT_CODE_PAIR_HASH mismatch! The Router would compute wrong pair " +
        "addresses and every swap/quote would fail.\n" +
        `  Set INIT_CODE_PAIR_HASH = hex'${computedHash.slice(2)}' in\n` +
        "  contracts/periphery/libraries/UniswapV2Library.sol, then " +
        "`npm run compile` and re-run deploy.",
    );
  }
  console.log("Init code hash OK — library matches this build.\n");

  // --- 1. WXP (WETH9) ---
  const WETH9 = await ethers.getContractFactory("WETH9");
  const wxp = await WETH9.deploy();
  await wxp.waitForDeployment();
  const wxpAddr = await wxp.getAddress();
  console.log(`WXP (WETH9)        : ${wxpAddr}`);

  // --- 2. Factory ---
  const Factory = await ethers.getContractFactory("UniswapV2Factory");
  const factory = await Factory.deploy(deployerAddr); // feeToSetter = deployer
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log(`UniswapV2Factory   : ${factoryAddr}`);

  // On-chain confirmation of the hash exposed by the factory.
  const onchainHash: string = await factory.INIT_CODE_PAIR_HASH();
  console.log(`Factory INIT hash  : ${onchainHash}`);
  if (onchainHash.toLowerCase() !== computedHash.toLowerCase()) {
    throw new Error(
      "Factory.INIT_CODE_PAIR_HASH does not match computed hash — aborting.",
    );
  }

  // --- 3. Router02 ---
  const Router = await ethers.getContractFactory("UniswapV2Router02");
  const router = await Router.deploy(factoryAddr, wxpAddr);
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();
  console.log(`UniswapV2Router02  : ${routerAddr}`);

  // --- Persist ---
  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployerAddr,
    deployedAt: new Date().toISOString(),
    initCodePairHash: computedHash,
    contracts: {
      WXP: wxpAddr,
      UniswapV2Factory: factoryAddr,
      UniswapV2Router02: routerAddr,
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });
  const outPath = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

  console.log(`\nSaved deployment to: ${outPath}`);
  console.log("\n=== Paste these into the frontend ===");
  console.log(`PANCAKE_ROUTER (lib/pancake.ts) = ${routerAddr}`);
  console.log(`WBNB           (lib/pancake.ts) = ${wxpAddr}`);
  console.log(`Factory (reference)             = ${factoryAddr}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

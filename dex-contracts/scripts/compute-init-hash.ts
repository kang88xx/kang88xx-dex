/**
 * Prints keccak256(type(UniswapV2Pair).creationCode) for THIS build.
 *
 * This is the value UniswapV2Library.INIT_CODE_PAIR_HASH must contain so that
 * Router pairFor() computes correct pair addresses off-chain. Run it AFTER any
 * change to UniswapV2Pair.sol / compiler settings, then paste the result into
 * contracts/periphery/libraries/UniswapV2Library.sol.
 *
 *   npm run hash
 */
import { ethers, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // creationCode == the contract's deploy (init) bytecode.
  const artifact = await artifacts.readArtifact("UniswapV2Pair");
  const initCode = artifact.bytecode;
  const hash = ethers.keccak256(initCode);

  // What the library currently has hardcoded, for an at-a-glance comparison.
  let current = "(could not read UniswapV2Library source)";
  try {
    const libPath = path.join(
      __dirname,
      "..",
      "contracts",
      "periphery",
      "libraries",
      "UniswapV2Library.sol",
    );
    const src = fs.readFileSync(libPath, "utf8");
    const m = src.match(/INIT_CODE_PAIR_HASH\s*=\s*hex'([0-9a-fA-F]+)'/);
    if (m) current = "0x" + m[1];
  } catch {
    /* ignore */
  }

  console.log("");
  console.log("=== UniswapV2Pair INIT CODE PAIR HASH ===");
  console.log("computed (this build):", hash);
  console.log("in UniswapV2Library  :", current);
  console.log("");

  if (current.toLowerCase() === hash.toLowerCase()) {
    console.log("OK — UniswapV2Library already matches this build.");
  } else {
    console.log("ACTION REQUIRED:");
    console.log(
      "  Open contracts/periphery/libraries/UniswapV2Library.sol and set:",
    );
    console.log(`    INIT_CODE_PAIR_HASH = hex'${hash.slice(2)}';`);
    console.log("  Then re-run `npm run compile` before deploying the Router.");
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

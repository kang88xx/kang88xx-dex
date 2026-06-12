/**
 * Seeds liquidity into the deployed DEX.
 *
 *   npm run seed     (network: xphere)
 *
 * Reads:
 *   - deployments/<network>.json   (Router address — must exist; run deploy first)
 *   - liquidity.config.json        (pairs + amounts — EDIT before running)
 *
 * For each ERC20<>ERC20 pair: approve(router) on both tokens, then addLiquidity.
 * For each native (eth) pair:  approve(router) on the token, then addLiquidityETH
 *                              (sends native XP as msg.value; router wraps to WXP).
 *
 * The token addresses are unknown until your real tokens exist — they live in
 * liquidity.config.json with placeholder values and comments. Edit that file.
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const ERC20_ABI = [
  "function approve(address spender, uint256 value) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
];

const ROUTER_ABI = [
  "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)",
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
];

interface Erc20Pair {
  kind: "erc20";
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  decimalsA?: number;
  decimalsB?: number;
}
interface EthPair {
  kind: "eth";
  token: string;
  amountToken: string;
  amountETH: string;
  decimalsToken?: number;
}
type Pair = Erc20Pair | EthPair;

const ZERO_PLACEHOLDERS = [
  "0x0000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000002",
  "0x0000000000000000000000000000000000000003",
];

async function ensureApproval(
  token: string,
  owner: string,
  router: string,
  amount: bigint,
  signer: any,
) {
  const erc20 = new ethers.Contract(token, ERC20_ABI, signer);
  const current: bigint = await erc20.allowance(owner, router);
  if (current >= amount) {
    console.log(`  approve ${token}: already sufficient`);
    return;
  }
  console.log(`  approve ${token} -> router (${amount})`);
  const tx = await erc20.approve(router, amount);
  await tx.wait();
}

async function main() {
  const [signer] = await ethers.getSigners();
  const owner = await signer.getAddress();

  // Router address from the deploy output.
  const deploymentPath = path.join(
    __dirname,
    "..",
    "deployments",
    `${network.name}.json`,
  );
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      `No deployment found at ${deploymentPath}. Run \`npm run deploy\` first.`,
    );
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const routerAddr: string = deployment.contracts.UniswapV2Router02;
  console.log(`Network : ${network.name}`);
  console.log(`Router  : ${routerAddr}`);
  console.log(`Signer  : ${owner}\n`);

  // Liquidity config.
  const cfgPath = path.join(__dirname, "..", "liquidity.config.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const pairs: Pair[] = cfg.tokenPairs ?? [];
  if (pairs.length === 0) {
    console.log("No tokenPairs in liquidity.config.json — nothing to seed.");
    return;
  }

  const router = new ethers.Contract(routerAddr, ROUTER_ABI, signer);
  const deadline = Math.floor(Date.now() / 1000) + 20 * 60;

  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    console.log(`\n[pair ${i + 1}/${pairs.length}] kind=${p.kind}`);

    if (p.kind === "erc20") {
      if (
        ZERO_PLACEHOLDERS.includes(p.tokenA) ||
        ZERO_PLACEHOLDERS.includes(p.tokenB)
      ) {
        console.log(
          "  SKIP — placeholder token address. Edit liquidity.config.json.",
        );
        continue;
      }
      const decA = p.decimalsA ?? 18;
      const decB = p.decimalsB ?? 18;
      const amtA = ethers.parseUnits(p.amountA, decA);
      const amtB = ethers.parseUnits(p.amountB, decB);

      await ensureApproval(p.tokenA, owner, routerAddr, amtA, signer);
      await ensureApproval(p.tokenB, owner, routerAddr, amtB, signer);

      console.log(`  addLiquidity ${p.tokenA} / ${p.tokenB}`);
      const tx = await router.addLiquidity(
        p.tokenA,
        p.tokenB,
        amtA,
        amtB,
        0, // amountAMin — 0 is fine for initial seeding by the LP owner
        0, // amountBMin
        owner,
        deadline,
      );
      const rc = await tx.wait();
      console.log(`  done (tx ${rc?.hash})`);
    } else if (p.kind === "eth") {
      if (ZERO_PLACEHOLDERS.includes(p.token)) {
        console.log(
          "  SKIP — placeholder token address. Edit liquidity.config.json.",
        );
        continue;
      }
      const decT = p.decimalsToken ?? 18;
      const amtToken = ethers.parseUnits(p.amountToken, decT);
      const amtETH = ethers.parseEther(p.amountETH);

      await ensureApproval(p.token, owner, routerAddr, amtToken, signer);

      console.log(`  addLiquidityETH ${p.token} + ${p.amountETH} XP`);
      const tx = await router.addLiquidityETH(
        p.token,
        amtToken,
        0, // amountTokenMin
        0, // amountETHMin
        owner,
        deadline,
        { value: amtETH },
      );
      const rc = await tx.wait();
      console.log(`  done (tx ${rc?.hash})`);
    } else {
      console.log(`  SKIP — unknown kind '${(p as any).kind}'`);
    }
  }

  console.log("\nSeeding complete.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

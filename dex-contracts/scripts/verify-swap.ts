import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const KDG = "0x4dE117D09842036e02F094E68086c5Dfd1132bDe";

async function main() {
  const d = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments", "xphere.json"), "utf8"),
  );
  const ROUTER = d.contracts.UniswapV2Router02;
  const WXP = d.contracts.WXP;
  const FACTORY = d.contracts.UniswapV2Factory;

  const factory = await ethers.getContractAt(
    ["function getPair(address,address) view returns (address)"],
    FACTORY,
  );
  const pairAddr = await factory.getPair(KDG, WXP);
  console.log("Pair (KDG/WXP):", pairAddr);

  const pair = await ethers.getContractAt(
    [
      "function getReserves() view returns (uint112,uint112,uint32)",
      "function token0() view returns (address)",
    ],
    pairAddr,
  );
  const [r0, r1] = await pair.getReserves();
  const token0 = await pair.token0();
  console.log("token0:", token0);
  console.log("reserve0:", r0.toString(), "reserve1:", r1.toString());

  const router = await ethers.getContractAt(
    ["function getAmountsOut(uint256,address[]) view returns (uint256[])"],
    ROUTER,
  );

  const oneXP = ethers.parseEther("1");
  const out1 = await router.getAmountsOut(oneXP, [WXP, KDG]);
  console.log(`\n1 XP -> ${ethers.formatUnits(out1[1], 18)} KDG`);

  const hundredKDG = ethers.parseUnits("100", 18);
  const out2 = await router.getAmountsOut(hundredKDG, [KDG, WXP]);
  console.log(`100 KDG -> ${ethers.formatEther(out2[1])} XP`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

import * as dotenv from "dotenv";
import { ethers } from "ethers";
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);
  const addr = await wallet.getAddress();
  const bal = await provider.getBalance(addr);
  const net = await provider.getNetwork();
  console.log("Deployer address:", addr);
  console.log("XP balance      :", ethers.formatEther(bal), "XP");
  console.log("chainId         :", net.chainId.toString());
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

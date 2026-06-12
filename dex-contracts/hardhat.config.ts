import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.RPC_URL ?? "";
const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const XPHERE_CHAIN_ID = process.env.XPHERE_CHAIN_ID
  ? Number(process.env.XPHERE_CHAIN_ID)
  : undefined;

const config: HardhatUserConfig = {
  // Uniswap V2 is version-sensitive: core = 0.5.16, periphery + WETH9 = 0.6.6.
  solidity: {
    compilers: [
      {
        version: "0.5.16",
        settings: {
          // Canonical Uniswap V2 core optimizer settings.
          optimizer: { enabled: true, runs: 999999 },
        },
      },
      {
        version: "0.6.6",
        settings: {
          // Canonical Uniswap V2 periphery optimizer settings.
          optimizer: { enabled: true, runs: 999999 },
        },
      },
    ],
  },
  networks: {
    // Local in-process network (default for `npm run hash` / deploy:local).
    hardhat: {},
    // Xphere — set RPC_URL + PRIVATE_KEY (and optionally XPHERE_CHAIN_ID) in .env.
    xphere: {
      url: RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      ...(XPHERE_CHAIN_ID ? { chainId: XPHERE_CHAIN_ID } : {}),
    },
  },
};

export default config;

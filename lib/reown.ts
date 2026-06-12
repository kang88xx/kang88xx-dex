import { cookieStorage, createStorage } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { opBNBTestnet } from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { ACTIVE_CHAIN, IS_TESTNET } from "./chain";

// Get one at https://dashboard.reown.com → set in .env.local
export const projectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";

if (!projectId && typeof window !== "undefined") {
  console.warn(
    "[reown] NEXT_PUBLIC_REOWN_PROJECT_ID is not set — wallet connection " +
      "will not work. Create a project at https://dashboard.reown.com and " +
      "add the ID to .env.local",
  );
}

// Active BNB chain (testnet or mainnet) — driven by NEXT_PUBLIC_CHAIN_ENV.
// On testnet, opBNB Testnet rides along as the USDT bridge counterpart so
// the wallet can switch chains on /bridge. Append more chains to expand.
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = IS_TESTNET
  ? [ACTIVE_CHAIN, opBNBTestnet]
  : [ACTIVE_CHAIN];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

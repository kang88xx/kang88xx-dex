import { cookieStorage, createStorage } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { ACTIVE_CHAIN } from "./chain";

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
// Append more chains here to expand (e.g. arbitrum).
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [ACTIVE_CHAIN];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

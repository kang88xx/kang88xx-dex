import { cookieStorage, createStorage } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { bsc } from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";

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

// BSC first; append more chains here to expand (e.g. mainnet, arbitrum)
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [bsc];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

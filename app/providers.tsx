"use client";

import { type ReactNode, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { useAppKitTheme } from "@reown/appkit/react";
import { bsc } from "@reown/appkit/networks";
import {
  cookieToInitialState,
  useAccount,
  WagmiProvider,
  type Config,
} from "wagmi";
import { projectId, wagmiAdapter, networks } from "@/lib/reown";
import { useDexStore } from "@/lib/store";

const queryClient = new QueryClient();

const metadata = {
  name: "IOI",
  description:
    "IOI is a decentralized exchange: swap tokens, provide liquidity, track markets, stake, and claim airdrops.",
  url:
    typeof window !== "undefined"
      ? window.location.origin
      : "https://ioi.exchange",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  defaultNetwork: bsc,
  metadata,
  features: {
    analytics: true,
    email: false,
    socials: false,
  },
  themeVariables: {
    "--w3m-accent": "#1A1AEE",
    "--w3m-border-radius-master": "2px",
  },
});

/**
 * Mirrors the real wagmi wallet session into the Zustand store so the rest
 * of the app (balances, positions, games…) keys off the real address.
 * Ignores transient "connecting"/"reconnecting" states.
 */
function WalletSync() {
  const { address, status } = useAccount();
  const setWalletSession = useDexStore((s) => s.setWalletSession);

  useEffect(() => {
    if (status === "connected" && address) setWalletSession(address);
    else if (status === "disconnected") setWalletSession(null);
  }, [address, status, setWalletSession]);

  return null;
}

/** Keeps the AppKit modal theme in sync with the site light/dark toggle. */
function AppKitThemeSync() {
  const { setThemeMode } = useAppKitTheme();

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => setThemeMode(root.classList.contains("dark") ? "dark" : "light");
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [setThemeMode]);

  return null;
}

export function Providers({
  children,
  cookies,
}: {
  children: ReactNode;
  cookies: string | null;
}) {
  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig as Config,
    cookies,
  );

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig as Config}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>
        <WalletSync />
        <AppKitThemeSync />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

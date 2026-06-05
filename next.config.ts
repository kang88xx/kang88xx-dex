import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // Optional dep of @wagmi/core's Tempo connector (unused — BSC only).
      // Turbopack errors on the unresolved dynamic import without this stub.
      accounts: "./stubs/empty.ts",
    },
  },
};

export default nextConfig;

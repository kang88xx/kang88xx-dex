// Cross-chain USDT bridge config — shared by the /bridge UI and the
// /api/bridge relayer route. Pure data + ABI (no hooks), so it is safe to
// import from both client and server code.
//
// RETIRED on Xphere: this lock/release bridge spans BSC Testnet (97) ↔
// opBNB Testnet (5611) from the BSC era (contracts still live there).
// On Xphere the /bridge page shows its "coming soon" placeholder until a
// production bridge (e.g. XPBridge integration) is wired up — so
// BRIDGE_ENABLED is hard false; the config below is kept for reference.

export const BSC_TESTNET_ID = 97;
export const OPBNB_TESTNET_ID = 5611;

export interface BridgeSide {
  chainId: number;
  /** Full network name (wallet-facing) */
  label: string;
  /** Short name for compact UI */
  short: string;
  explorer: string;
  rpc: string;
  /** USDT (TestToken) contract on this chain */
  usdt: `0x${string}` | "";
  /** TestBridge contract on this chain */
  bridge: `0x${string}` | "";
}

export const BRIDGE_SIDES: Record<number, BridgeSide> = {
  [BSC_TESTNET_ID]: {
    chainId: BSC_TESTNET_ID,
    label: "BNB Smart Chain Testnet",
    short: "BSC Testnet",
    explorer: "https://testnet.bscscan.com",
    rpc:
      process.env.NEXT_PUBLIC_BSC_TESTNET_RPC ??
      "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    usdt: (process.env.NEXT_PUBLIC_TUSDT_ADDRESS ?? "") as `0x${string}` | "",
    bridge: (process.env.NEXT_PUBLIC_BRIDGE_TESTNET_BSC ?? "") as
      | `0x${string}`
      | "",
  },
  [OPBNB_TESTNET_ID]: {
    chainId: OPBNB_TESTNET_ID,
    label: "opBNB Testnet",
    short: "opBNB Testnet",
    explorer: "https://testnet.opbnbscan.com",
    rpc:
      process.env.NEXT_PUBLIC_OPBNB_TESTNET_RPC ??
      "https://opbnb-testnet-rpc.bnbchain.org",
    usdt: (process.env.NEXT_PUBLIC_TUSDT_OPBNB_ADDRESS ?? "") as
      | `0x${string}`
      | "",
    bridge: (process.env.NEXT_PUBLIC_BRIDGE_TESTNET_OPBNB ?? "") as
      | `0x${string}`
      | "",
  },
};

/** The one supported route, in canonical order. */
export const BRIDGE_CHAIN_IDS = [BSC_TESTNET_ID, OPBNB_TESTNET_ID] as const;

/** Hard-disabled on Xphere — the BSC-era testnet bridge doesn't apply here. */
export const BRIDGE_ENABLED = false;

export const BRIDGE_TOKEN_SYMBOL = "USDT";
export const BRIDGE_TOKEN_DECIMALS = 18;

export const TEST_BRIDGE_ABI = [
  {
    type: "function",
    name: "bridgeOut",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "dstChainId", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "release",
    stateMutability: "nonpayable",
    inputs: [
      { name: "transferId", type: "bytes32" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "processed",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "reserve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "BridgeOut",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "dstChainId", type: "uint64", indexed: true },
      { name: "nonce", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BridgeIn",
    inputs: [
      { name: "transferId", type: "bytes32", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

/** The opposite side of the route. */
export function otherSide(chainId: number): BridgeSide {
  return chainId === BSC_TESTNET_ID
    ? BRIDGE_SIDES[OPBNB_TESTNET_ID]
    : BRIDGE_SIDES[BSC_TESTNET_ID];
}

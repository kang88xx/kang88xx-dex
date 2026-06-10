// On-chain airdrop helpers — ABI + config for contracts/MerkleAirdrop.sol.
// The contract address comes from env via lib/chain.ts (empty until deployed).
import { AIRDROP_CONTRACT, CHAIN_ID } from "./chain";

export { AIRDROP_CONTRACT, CHAIN_ID };

/** True once a MerkleAirdrop contract address is configured for this network. */
export const airdropLive = AIRDROP_CONTRACT !== "";

// Minimal ABI — only what the app calls/reads.
export const AIRDROP_ABI = [
  {
    type: "function",
    name: "createCampaign",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "merkleRoot", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "endsAt", type: "uint64" },
      { name: "amountPerClaim", type: "uint256" },
      { name: "name", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [],
  },
  {
    // Public/open claim — any wallet claims the fixed amountPerClaim once.
    type: "function",
    name: "claimPublic",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    // Owner publishes a whitelist's allocations as an event (data availability)
    // so any visitor can rebuild their proof from the chain.
    type: "function",
    name: "publishWhitelist",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "accounts", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "hasClaimed",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "remaining",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    // Number of campaigns created so far (ids run 1..campaignCount).
    type: "function",
    name: "campaignCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    // Read a campaign's on-chain state by id.
    type: "function",
    name: "campaigns",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "token", type: "address" },
      { name: "merkleRoot", type: "bytes32" },
      { name: "funded", type: "uint256" },
      { name: "claimed", type: "uint256" },
      { name: "amountPerClaim", type: "uint256" },
      { name: "endsAt", type: "uint64" },
      { name: "active", type: "bool" },
    ],
  },
  {
    type: "event",
    name: "CampaignCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "merkleRoot", type: "bytes32", indexed: false },
      { name: "funded", type: "uint256", indexed: false },
      { name: "endsAt", type: "uint64", indexed: false },
      { name: "amountPerClaim", type: "uint256", indexed: false },
      { name: "name", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WhitelistPublished",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "accounts", type: "address[]", indexed: false },
      { name: "amounts", type: "uint256[]", indexed: false },
    ],
  },
] as const;

// On-chain Last Man Standing helpers — ABI + config for contracts/KangLMS.sol.
// The contract address comes from env via lib/chain.ts (empty until deployed).
import { CHAIN_ID, LMS_CONTRACT } from "./chain";

export { CHAIN_ID, LMS_CONTRACT };

/** True once a KangLMS contract address is configured for this network. */
export const lmsLive = LMS_CONTRACT !== "";

// Minimal ABI — only what the app calls/reads.
export const LMS_ABI = [
  {
    type: "function",
    name: "bet",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    // Anyone settles an expired round: credits the winner (or refunds the
    // sole bettor) and opens the next round.
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [],
  },
  {
    // Claim one winning round by id (settles a just-won pot first).
    type: "function",
    name: "claimRound",
    stateMutability: "nonpayable",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [],
  },
  {
    // Claim every unclaimed win/refund in one tx (pull-payment prizes).
    type: "function",
    name: "claimAll",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    // All win records for an address — { roundId, amount, claimed, isRefund }[].
    type: "function",
    name: "winsOf",
    stateMutability: "view",
    inputs: [{ name: "who", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "roundId", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "claimed", type: "bool" },
          { name: "isRefund", type: "bool" },
        ],
      },
    ],
  },
  {
    // Live round id + full state in one read.
    type: "function",
    name: "currentRound",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "id", type: "uint256" },
      { name: "prizePool", type: "uint256" },
      { name: "totalBurned", type: "uint256" },
      { name: "deadline", type: "uint64" },
      { name: "lastBettor", type: "address" },
      { name: "betCount", type: "uint32" },
      { name: "uniquePlayers", type: "uint32" },
      { name: "settled", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "pendingPrize",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "minBet",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "totalEverBurned",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "BetPlaced",
    inputs: [
      { name: "roundId", type: "uint256", indexed: true },
      { name: "bettor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "prizePool", type: "uint256", indexed: false },
      { name: "newDeadline", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RoundSettled",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "prize", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PrizeClaimed",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "roundId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

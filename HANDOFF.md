# Handoff — airdrop on-chain claims (2026-06-10)

Picking up on another device? Start here.

## What shipped (already on `main`)
On-chain airdrop claims that work for every visitor, not just the admin's browser.
- **Public campaigns**: open claim — any wallet claims a fixed amount once via
  `claimPublic(id)`. No proof, no off-chain list.
- **Whitelist campaigns**: allocations are published on-chain as an event
  (`publishWhitelist` → `WhitelistPublished`), so any visitor rebuilds their
  Merkle proof from the chain and claims.
- `/airdrop` reads campaigns straight from the contract (`useOnchainCampaigns`).
- `/admin` launches public + whitelist campaigns on-chain.
- `sweep()` now only works after a campaign ends (anti-rug).

Key files: `contracts/MerkleAirdrop.sol`, `lib/airdrop.ts`,
`lib/onchain-campaigns.ts`, `app/airdrop/page.tsx`, `app/admin/page.tsx`.

## Deployed (BSC testnet, chainId 97)
- **MerkleAirdrop**: `0xf8e59afa00d42c2a5da47360ad0c812c7c87464e`
- **Owner** (the only wallet that can launch/sweep): `0x70b4B19F85041bEa823A72D41f841Dc4e028B39D`
- Explorer: https://testnet.bscscan.com/address/0xf8e59afa00d42c2a5da47360ad0c812c7c87464e

## On the new device
1. Clone the repo, `npm install`.
2. Create `.env.local` (gitignored — NOT in the repo):
   ```
   NEXT_PUBLIC_CHAIN_ENV=testnet
   NEXT_PUBLIC_AIRDROP_TESTNET=0xf8e59afa00d42c2a5da47360ad0c812c7c87464e
   NEXT_PUBLIC_REOWN_PROJECT_ID=6bb8771e50f8c0efa5fe14c6545c98c2
   ADMIN_PASSWORD=<choose your own — do not commit it>
   ADMIN_SESSION_SECRET=<any 64-hex; generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
   ```
   (The actual password/secret for this machine live only in the local
   `.env.local`, never in git. Reuse them from there, or pick new ones.)
3. `npm run dev` → http://localhost:3000
4. Re-deploying contracts is NOT needed (already deployed). Only if you do, put a
   TESTNET-ONLY `DEPLOYER_PRIVATE_KEY` in `.env.deploy` (gitignored).

## To launch a campaign on-chain (from /admin)
- Connect the **owner** wallet `0x70b4…B39D` on BSC Testnet.
- That wallet must hold enough of the reward token (KANG `0x9552…` or XP `0x0658…`;
  IOI has no contract so it can't be used).
- Create campaign → "온체인 발행" → approve + createCampaign (whitelist also publishes).

## Still open
- **Vercel env var**: live site (https://kang88xx-dex.vercel.app) still needs
  `NEXT_PUBLIC_AIRDROP_TESTNET=0xf8e59afa…` added under **Production** scope, then
  redeploy. Code + reown id + admin auth are already live; only this var is missing.
- Public claim is sybil-farmable by design (open claim). Switch to signature-gated
  if that matters.
- `publishWhitelist` gas scales with list size — split very large whitelists.
- Contract is UNAUDITED. Audit before mainnet.

## Outstanding security findings (from pre-launch review, not yet fixed)
- `/api/analytics` accepts unauthenticated, uncapped client `volumeUsd` (fake volume/APR).
- No security headers (CSP, X-Frame-Options, etc.) in `next.config.ts`.
- Login rate limit keyed on spoofable `X-Forwarded-For`.
- Admin sessions can't be revoked before expiry.

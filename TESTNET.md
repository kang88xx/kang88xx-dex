# Running on BSC Testnet (and flipping to mainnet later)

This app runs on **BSC Testnet (chainId 97)** by default and flips to **BSC
Mainnet (chainId 56)** with a single env var — no code change.

| Env var | testnet (default) | mainnet |
| --- | --- | --- |
| `NEXT_PUBLIC_CHAIN_ENV` | `testnet` (or unset) | `mainnet` |

Everything else (wallet network, PancakeSwap router, WBNB, token registry)
derives from that flag in `lib/chain.ts`.

---

## 1. Get free testnet BNB (for gas)

1. Copy your wallet address.
2. Go to the faucet: <https://testnet.bnbchain.org/faucet-smart>
   (or <https://www.bnbchain.org/en/testnet-faucet>)
3. Paste the address → receive 0.1–0.5 tBNB. This pays gas for everything below.

Add BSC Testnet to MetaMask if needed:
- Network name: `BNB Smart Chain Testnet`
- RPC: `https://data-seed-prebsc-1-s1.bnbchain.org:8545`
- Chain ID: `97`
- Symbol: `tBNB`
- Explorer: `https://testnet.bscscan.com`

---

## 2. Deploy your pegged test USDT

We ship a zero-dependency ERC-20 at `contracts/TestToken.sol` (18 decimals,
matching real BSC-peg USDT).

1. Open <https://remix.ethereum.org>.
2. Create `TestToken.sol`, paste the contents of `contracts/TestToken.sol`.
3. Compile (Solidity 0.8.20+).
4. **Deploy & Run** tab → Environment = **Injected Provider - MetaMask**
   (make sure MetaMask is on BSC Testnet, chainId 97).
5. Constructor args:
   - `_name`  = `Test Tether`
   - `_symbol` = `USDT`
   - `initialMint` = `1000000`  (you receive 1,000,000 USDT)
6. Click **Deploy**, confirm in MetaMask.
7. Copy the deployed contract address.

Need more later? Call `mint(yourAddress, amount)` (owner only) or the open
`faucet()` (anyone gets 10,000).

> Want other test tokens too (e.g. a second stablecoin, a "BTC")? Deploy
> `TestToken.sol` again with different name/symbol and add them to the
> `TESTNET_TOKENS` array in `lib/tokens.ts`.

---

## 3. Point the app at your test USDT

Add the deployed address to `.env.local`:

```
NEXT_PUBLIC_CHAIN_ENV=testnet
NEXT_PUBLIC_TUSDT_ADDRESS=0xYourDeployedTestUSDT
```

Restart `npm run dev`. USDT now appears in the swap/token list. On Vercel, add
the same two vars (Preview/Production) and redeploy.

---

## 4. Make USDT actually "pegged" — seed a liquidity pool

A token's USD price on a DEX is set by its pool ratio, not by the contract.
To make **1 USDT ≈ $1**, add liquidity on PancakeSwap testnet at the matching
ratio. Example with tBNB at ~$600:

1. Go to PancakeSwap testnet: <https://pancakeswap.finance/add> (switch wallet
   to chainId 97 — Pancake serves the testnet pools when your wallet is on it).
2. Pick **BNB** + **USDT** (paste your test USDT address to import it).
3. Add at the price you want the peg to hold, e.g.
   `1 BNB : 600 USDT` → 1 USDT = $1/600 BNB ≈ $1.
4. Confirm `Approve USDT`, then `Supply`. This creates the pair so the app's
   PancakeSwap quotes/swaps have a route.

The more liquidity you add, the more stable the "peg" against test trades.

> Router/WBNB used on testnet (overridable via `NEXT_PUBLIC_PANCAKE_ROUTER` /
> `NEXT_PUBLIC_WBNB` if PancakeSwap changes them):
> - Router V2: `0xD99D1c33F9fC3444f8101754aBC46c52416550D1`
> - WBNB: `0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd`
>
> Verify current values on <https://testnet.bscscan.com> if a swap can't find a
> route — testnet contracts occasionally get redeployed.

---

## 5. Test the full flow

1. `npm run dev`, open the app, connect wallet (it defaults to BSC Testnet).
2. Swap tBNB → USDT. You should get a quote from your pool and a real on-chain tx.
3. Check the tx on <https://testnet.bscscan.com>.

---

## 6. Going live on BSC Mainnet

When testing is done:

1. On Vercel set `NEXT_PUBLIC_CHAIN_ENV=mainnet` (and remove
   `NEXT_PUBLIC_TUSDT_ADDRESS` — mainnet uses the canonical token list).
2. Redeploy. The app now uses real BSC contracts and PancakeSwap mainnet
   liquidity. No code change required.

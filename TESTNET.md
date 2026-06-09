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
matching real BSC-peg USDT) plus a pre-compiled artifact
(`contracts/TestToken.artifact.json`) and a one-command deploy script.

### Option A — one command (recommended)

You sign with your own key; it never leaves your machine.

1. Copy the env template and fill it in (it is gitignored):
   ```
   cp .env.deploy.example .env.deploy
   ```
   ```
   DEPLOYER_PRIVATE_KEY=0x...    # a THROWAWAY testnet key holding only test BNB
   TOKEN_NAME=Test Tether
   TOKEN_SYMBOL=USDT
   TOKEN_SUPPLY=1000000
   ```
   > To export a key from MetaMask: Account → ⋮ → Account details → Show private
   > key. Use a fresh/throwaway account for this — **never** a key with real funds.
2. Run:
   ```
   npm run deploy:token
   ```
3. It prints the deployed contract address + a testnet.bscscan link.

### Option B — Remix (no key in a file)

1. Open <https://remix.ethereum.org>, create `TestToken.sol`, paste
   `contracts/TestToken.sol`, compile (Solidity 0.8.20+).
2. **Deploy & Run** → Environment = **Injected Provider - MetaMask**
   (MetaMask on BSC Testnet, chainId 97).
3. Constructor args: `_name`=`Test Tether`, `_symbol`=`USDT`,
   `initialMint`=`1000000`. Deploy, confirm, copy the address.

Need more tokens later? Call `mint(yourAddress, amount)` (owner only) or the
open `faucet()` (anyone gets 10,000).

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

## 5b. Issue a new token / meme coin on testnet

The same `TestToken` contract mints any token — a stablecoin, a "BTC", or a
meme coin. Three steps:

1. **Deploy it.** Edit `.env.deploy` and re-run the script:
   ```
   TOKEN_NAME=Doge Killer
   TOKEN_SYMBOL=DOGEK
   TOKEN_SUPPLY=1000000000     # 1B supply, classic meme tokenomics
   ```
   ```
   npm run deploy:token
   ```
   Copy the printed address.

2. **List it in the DEX.** Go to `/admin` → **Add swap token**, enter the
   symbol (`DOGEK`), name, the deployed address, and `18` decimals. It appears
   in the swap picker immediately (no redeploy). You can disable/remove it there
   too.

3. **Give it a price = create a pool.** On PancakeSwap testnet
   (<https://pancakeswap.finance/add>) add liquidity pairing your token with BNB
   or your test USDT at whatever ratio you want its launch price to be. Example:
   `1,000,000 DOGEK : 1 BNB` → very cheap meme price. Without a pool the token
   shows in the list but swaps say "No liquidity route".

Tips:
- `faucet()` lets any tester grab 10,000 of the token; `mint(addr, amount)`
  (owner) tops up specific wallets.
- Deploy as many tokens as you like — just change `TOKEN_*` and re-run.
- The logo is auto-generated (initials on a colored circle); custom art isn't
  needed for testing.

---

## 6. Going live on BSC Mainnet

When testing is done:

1. On Vercel set `NEXT_PUBLIC_CHAIN_ENV=mainnet` (and remove
   `NEXT_PUBLIC_TUSDT_ADDRESS` — mainnet uses the canonical token list).
2. Redeploy. The app now uses real BSC contracts and PancakeSwap mainnet
   liquidity. No code change required.

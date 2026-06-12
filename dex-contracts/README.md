# Xphere DEX (Uniswap V2 / PancakeSwap-equivalent)

Self-contained Hardhat project that deploys a Uniswap-V2-style DEX to the
**Xphere** EVM chain. It provides exactly the contracts the frontend
(`lib/pancake.ts`) talks to: a Router02 with `getAmountsOut`,
`swapExactTokensForTokens`, `swapExactETHForTokens`, `swapExactTokensForETH`,
plus the Factory and a wrapped-native token (**WXP**, a standard WETH9).

This is a **separate project** from the Next.js app — its own `package.json`
and `node_modules`. It does not touch the frontend.

## Contracts

| Contract            | Solidity | Role                                            |
| ------------------- | -------- | ----------------------------------------------- |
| `WETH9` (→ **WXP**) | 0.6.6    | Wrapped native Xphere; what `WBNB` becomes here |
| `UniswapV2Factory`  | 0.5.16   | Creates pairs (CREATE2)                          |
| `UniswapV2Pair`     | 0.5.16   | The AMM pool (deployed by the factory)          |
| `UniswapV2Router02` | 0.6.6    | What the frontend calls                         |
| `TestERC20`         | 0.6.6    | Optional mintable token to bootstrap pools      |

Core (0.5.16) and periphery (0.6.6) are compiled by **two** compilers,
configured in `hardhat.config.ts`.

---

## ⚠️ The init code pair hash footgun — READ THIS

`UniswapV2Library.pairFor()` computes a pair's address **off-chain**, without an
RPC call, using:

```
pair = CREATE2(factory, keccak256(token0,token1), INIT_CODE_PAIR_HASH)
```

`INIT_CODE_PAIR_HASH` is `keccak256(type(UniswapV2Pair).creationCode)` and is
**hardcoded** in `contracts/periphery/libraries/UniswapV2Library.sol`. It is
**build-specific** — it changes with the Pair source, compiler version, and
optimizer settings.

The value committed in the repo is the **Uniswap mainnet** hash and is **wrong
for your build**. If you deploy the Router with the wrong hash, the Router
computes a non-existent pair address for every pair, so **every quote and swap
silently fails** (the frontend just sees "no route").

You **must** sync it before deploying the Router:

```bash
npm run hash
```

This prints the correct hash for this build and tells you whether the library
already matches. If it does not match, open
`contracts/periphery/libraries/UniswapV2Library.sol` and set:

```solidity
bytes32 internal constant INIT_CODE_PAIR_HASH =
    hex'<paste the printed hash WITHOUT the 0x prefix>';
```

Then re-compile. Both `npm run hash` and the deploy script check this and the
deploy script **aborts** on a mismatch, so you can't ship a broken Router.
The factory also exposes it on-chain via `UniswapV2Factory.INIT_CODE_PAIR_HASH()`.

---

## Step-by-step

### 1. Install

```bash
cd dex-contracts
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in:

- `RPC_URL` — Xphere JSON-RPC endpoint
- `PRIVATE_KEY` — deployer key (funded with native XP for gas)
- `XPHERE_CHAIN_ID` — optional, pins the chain id

### 3. Compile

```bash
npm run compile
```

### 4. Sync the init code hash (the footgun)

```bash
npm run hash
```

If it reports a mismatch, paste the printed hash into
`contracts/periphery/libraries/UniswapV2Library.sol` (see above), then
`npm run compile` again and re-run `npm run hash` to confirm it says **OK**.

### 5. Deploy

```bash
npm run deploy          # network: xphere (uses .env)
# or, to dry-run locally:
npm run deploy:local    # network: hardhat (in-process)
```

The deploy script:

- deploys **WXP** (WETH9), **Factory** (`feeToSetter` = deployer), **Router02**
- re-verifies the init hash and **aborts on mismatch**
- writes `deployments/xphere.json` with all addresses + the hash
- logs the exact values to paste into the frontend

### 6. Record the addresses

`deployments/xphere.json` will contain:

```json
{
  "contracts": {
    "WXP": "0x...",
    "UniswapV2Factory": "0x...",
    "UniswapV2Router02": "0x..."
  },
  "initCodePairHash": "0x..."
}
```

### 7. Configure & seed liquidity

The Router can quote/swap a pair only if that pair has liquidity. Edit
`liquidity.config.json` — replace the placeholder token addresses
(`0x000…0001`, etc.) with real Xphere token addresses and set amounts. Two pair
kinds are supported:

- `"kind": "erc20"` — token↔token (`tokenA`, `tokenB`, `amountA`, `amountB`)
- `"kind": "eth"` — token↔native XP (`token`, `amountToken`, `amountETH`)

Then:

```bash
npm run seed
```

It approves the router and calls `addLiquidity` / `addLiquidityETH` per pair.
Pairs still pointing at placeholder addresses are skipped.

> No real tokens yet? Deploy `TestERC20` (mint to yourself), put its address in
> `liquidity.config.json`, and seed a `WXP`/test pool so the frontend has a
> working route to demo.

---

## Wiring the frontend

After deploy, update the Next.js app at the repo root:

1. **`lib/pancake.ts`**
   - `PANCAKE_ROUTER` → `contracts.UniswapV2Router02`
   - `WBNB` → `contracts.WXP`
     (these names are historical; on Xphere they are the Router and WXP)

2. **`lib/reown.ts`** — add the Xphere chain so wallets can connect. The file
   currently imports `bsc` from `@reown/appkit/networks` and sets
   `networks = [bsc]`. Define Xphere as a custom network and use it, e.g.:

   ```ts
   import { defineChain } from "@reown/appkit/networks";

   export const xphere = defineChain({
     id: Number(process.env.NEXT_PUBLIC_XPHERE_CHAIN_ID), // your chain id
     caipNetworkId: `eip155:${process.env.NEXT_PUBLIC_XPHERE_CHAIN_ID}`,
     chainNamespace: "eip155",
     name: "Xphere",
     nativeCurrency: { name: "Xphere", symbol: "XP", decimals: 18 },
     rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_XPHERE_RPC_URL!] } },
   });

   export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [xphere];
   ```

   (Confirm the exact `defineChain` API against the installed `@reown/appkit`
   version — APIs in this repo may differ from upstream.)

3. The frontend token registry (`lib/tokens.ts`) must use the **Xphere** token
   addresses you seeded liquidity for, and `BNB` becomes native **XP** (mapped
   to `WXP` in router paths).

---

## Scripts

| Command                | What it does                                        |
| ---------------------- | --------------------------------------------------- |
| `npm run compile`      | Compile all contracts (0.5.16 + 0.6.6)              |
| `npm run hash`         | Print + check `INIT_CODE_PAIR_HASH`                 |
| `npm run deploy`       | Deploy to `xphere` (writes `deployments/xphere.json`) |
| `npm run deploy:local` | Deploy to in-process `hardhat` network              |
| `npm run seed`         | Seed liquidity from `liquidity.config.json`         |

## What you must provide

- A funded `PRIVATE_KEY` and a working `RPC_URL` for Xphere
- The Xphere `chainId`
- Real token addresses (+ amounts) in `liquidity.config.json`
- Frontend env: `NEXT_PUBLIC_XPHERE_CHAIN_ID`, `NEXT_PUBLIC_XPHERE_RPC_URL`

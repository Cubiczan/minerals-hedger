# Minerals Hedger — dreamDEX perps bot

Hedges a physical-minerals (gold) inventory on dreamDEX perps through a **proxy pair**, because dreamDEX lists no metals perps. PAXG (a tokenized troy ounce) is the gold series. The bot finds which listed perp's hourly returns correlate best with gold, computes the beta, and holds the opposite-side proxy position sized at beta × inventory value. If no proxy passes `MIN_ABS_CORR`, it stands aside.

Built for the Somnia **dreamDEX Perps Builder Bounty** with [`@somnia-chain/markets-sdk`](https://www.npmjs.com/package/@somnia-chain/markets-sdk) 0.32.1. It runs on the **Hideki testnet** (chain 50383), where app.testnet.dreamdex.io lives. Order sizes are the market minimum.

## Setup
```bash
git clone https://github.com/icohangar-ops/minerals-hedger && cd minerals-hedger
npm install
cp .env.example .env        # PRIVATE_KEY of a throwaway Hideki testnet wallet
```
The wallet needs:
- a little STT for gas, from the Somnia faucet.
- USDso in its dreamDEX MarginBank: deposit in the app, or call `trader.depositMargin`.

```bash
npm run dry                 # DRY_RUN=true: logs intended orders, sends nothing
DRY_RUN=false npm start   # live
```
Each live order is appended to `txs.jsonl` (kind, tag, symbol, size, tx hash).

### Config (env)
`INVENTORY_OZ` (0.01), `PROXIES` (BTC,ETH,SOL,LINK,AVAX), `HOURS` (96), `MIN_ABS_CORR` (0.1), `UNWIND` (default true for the demo: unwinds after 15 s)

## How it works
- `src/lib.ts` connects `SomniaMarkets` to Hideki (RPC `https://api.hideki2.infra.testnet.somnia.network`, indexer `https://hideki-dev.smk.somnia.host/v1/graphql`).
- `src/perp.ts` holds thin helpers: place (limit or IOC), cancel, close, position and margin reads, all tick- and lot-aligned.
- `src/bot.ts` holds the strategy.

## Real testnet run (Hideki, 2026-10-21 UTC)
Over 96 h, BTC had the highest correlation with gold (corr 0.65, beta 0.30). A 0.01 oz inventory (≈$41) maps to a ≈$12 BTC hedge, so the bot shorted 0.00014 BTC and then unwound it. This is a proxy hedge with basis risk. Gold-crypto correlation is regime-dependent; the bot prints it every run.

Account `0xdFAFacBA862d1a9d6fb94eCE7842E95e7091DCbD`

| action | tag | market | size | tx hash |
|---|---|---|---|---|
| place market short | hedge 0.01oz via BTC | BTC/USDso:USDso | 0.00014 | `0x685a5335e1aafb6089791f547b9927eef5c04ef26e9f30d78a7ef2639a4298a7` |
| place market long | hedge-unwind | BTC/USDso:USDso | 0.00014 | `0xac02ed8b6e01042ae2fa6aab1c1b19cdcaeb29ab307d2f2a5c22a3b4ec051af3` |

Verify any of these with `eth_getTransactionReceipt` against `https://api.hideki2.infra.testnet.somnia.network`.

## Disclaimer
This is testnet software, not financial advice. Never put a mainnet key in `.env`.

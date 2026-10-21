// minerals-hedger: hedges a physical-minerals inventory on dreamDEX perps through a proxy.
// dreamDEX lists no metals perps, so the bot measures which listed perp tracks gold best
// (PAXG, a tokenized ounce of gold, is the gold series) over recent hourly returns, computes
// the regression beta, and holds the opposite-side proxy position sized beta x inventory value.
import { place, close, position, mid, market, align } from "./perp.ts";
const env = (k: string, d: number) => (process.env[k] ? Number(process.env[k]) : d);
const INVENTORY_OZ = env("INVENTORY_OZ", 0.01);           // ounces of gold-equivalent held
const CANDIDATES = (process.env.PROXIES ?? "BTC,ETH,SOL,LINK,AVAX").split(",");
const HOURS = env("HOURS", 96), MIN_CORR = env("MIN_ABS_CORR", 0.1);
const UNWIND = process.env.UNWIND !== "false";
const candles = async (p: string) => { const r = await (await fetch(`https://api.exchange.coinbase.com/products/${p}/candles?granularity=3600`)).json(); return (r as any[]).slice(0, HOURS + 1).reverse().map((x) => x[4] as number); };
const rets = (c: number[]) => c.slice(1).map((v, i) => Math.log(v / c[i]));
const gold = await candles("PAXG-USD"); const g = rets(gold); const goldPx = gold[gold.length - 1];
const stats: any[] = [];
for (const s of CANDIDATES) {
  try { const r = rets(await candles(`${s}-USD`)); const n = Math.min(r.length, g.length); const x = r.slice(-n), y = g.slice(-n);
    const mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n; let cov = 0, vx = 0, vy = 0;
    for (let i = 0; i < n; i++) { cov += (x[i] - mx) * (y[i] - my); vx += (x[i] - mx) ** 2; vy += (y[i] - my) ** 2; }
    stats.push({ proxy: s, corr: cov / Math.sqrt(vx * vy), beta: cov / vx, n }); } catch (e) { console.log(s, "no data"); }
}
stats.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr)); console.table(stats);
const best = stats[0];
const invUsd = INVENTORY_OZ * goldPx;
console.log(`inventory ${INVENTORY_OZ} oz x $${goldPx} = $${invUsd.toFixed(2)}; best proxy ${best.proxy} corr=${best.corr.toFixed(3)} beta(gold on proxy)=${best.beta.toFixed(3)}`);
if (Math.abs(best.corr) < MIN_CORR) { console.log("no proxy tracks gold well enough; not hedging"); process.exit(0); }
const m = await market(best.proxy); const { bid, ask, mid: px } = await mid(best.proxy);
const hedgeUsd = Math.abs(best.beta) * invUsd;
const lot = BigInt(m.info.lotSize), minQ = BigInt(m.info.minQuantity);
let qty = align(BigInt(Math.floor((hedgeUsd / px) * 10 ** m.info.baseDecimals)), lot);
if (qty < minQ) { console.log(`hedge $${hedgeUsd.toFixed(2)} is below the ${m.symbol} minimum; using the minimum size (over-hedged, demo)`); qty = minQ; }
const side = best.beta > 0 ? "short" : "long"; // long gold inventory -> short a positively-correlated proxy
await place(best.proxy, side, qty, side === "short" ? (bid ?? px) * 0.99 : (ask ?? px) * 1.01, "market", `hedge ${INVENTORY_OZ}oz via ${best.proxy}`);
console.log("hedge position", (await position(best.proxy) as any).size);
if (UNWIND) { await new Promise((r) => setTimeout(r, 15000)); await close(best.proxy, "hedge-unwind"); }
process.exit(0);

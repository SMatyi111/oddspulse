// Live integration check, no Telegram needed:
// 1. sweeps the real Kalshi API
// 2. fabricates a "one hour ago" state with shifted prices for a few markets
// 3. runs detection and prints the exact messages the bot would send
import { config } from "../src/config.js";
import { sweepLiquidMarkets } from "../src/kalshi.js";
import { updateAndDetect } from "../src/detect.js";
import { formatAlert } from "../src/telegram.js";

const now = Date.now();
const { markets, pages } = await sweepLiquidMarkets(config);
console.log(`live sweep: ${pages} pages, ${markets.length} liquid markets`);
if (markets.length < 50) throw new Error("suspiciously few markets — API or filter problem");

const cats = {};
for (const m of markets) cats[m.category] = (cats[m.category] || 0) + 1;
console.log("by category:", JSON.stringify(cats));

// Fabricate prior state: the 3 highest-volume MID-RANGE markets get shifted history
// (mid-range so the ±15pp shift survives the 1–99% clamp; distinct series so the
// per-series pick doesn't merge them), rest unchanged.
const seenSeries = new Set();
const byVol = [...markets]
  .filter((m) => m.prob >= 0.25 && m.prob <= 0.75)
  .sort((a, b) => b.vol24 - a.vol24)
  .filter((m) => !seenSeries.has(m.series) && seenSeries.add(m.series));
if (byVol.length < 3) throw new Error("fewer than 3 mid-range liquid markets — filters too tight?");
const shifted = new Map([
  [byVol[0].ticker, -0.15],
  [byVol[1].ticker, -0.15],
  [byVol[2].ticker, +0.12],
]);
const state = { markets: {} };
for (const m of markets) {
  const shift = shifted.get(m.ticker) || 0;
  const oldProb = Math.min(0.99, Math.max(0.01, m.prob + shift));
  state.markets[m.ticker] = {
    title: m.title,
    sub: m.sub,
    series: m.series,
    category: m.category,
    hist: [[now - 55 * 60_000, oldProb]],
    lastAlert: null,
  };
}

const alerts = updateAndDetect(state, markets, now, config);
console.log(`\ndetected ${alerts.length} alerts (expected: 3 fabricated + any real moves in the last 55 min)\n`);
if (alerts.length < 3) throw new Error("fabricated moves not detected — detection logic broken");
for (const a of alerts.slice(0, config.maxAlertsPerRun)) {
  console.log("---");
  console.log(formatAlert(a));
}
console.log("\nintegration: OK");

import { config } from "./config.js";
import { sweepLiquidMarkets } from "./kalshi.js";
import { updateAndDetect, commitAlerts } from "./detect.js";
import { loadState, saveState } from "./state.js";
import { formatAlert, broadcast, processCommands } from "./telegram.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const statePath = process.env.STATE_FILE || (dryRun ? "local-state.json" : "state.json");

const state = loadState(statePath);
const firstRun = Object.keys(state.markets).length === 0;
const now = Date.now();

const { markets, pages } = await sweepLiquidMarkets(config);
console.log(
  `swept ${pages} pages → ${markets.length} liquid markets ` +
    `(min vol24h ${config.minVol24h}, excluded: ${config.excludedCategories.join("/") || "none"})`,
);

let alerts = updateAndDetect(state, markets, now, config);
if (firstRun) {
  console.log("first run: baseline stored, alerts suppressed");
  alerts = [];
}
const top = alerts.slice(0, config.maxAlertsPerRun);
const dropped = alerts.length - top.length;
commitAlerts(state, top, now);

if (dryRun || !config.telegramToken) {
  if (!dryRun) console.log("no TELEGRAM_BOT_TOKEN set; printing alerts instead:");
  for (const a of top) console.log("---\n" + formatAlert(a));
  if (dropped > 0) console.log(`(+${dropped} more suppressed this cycle)`);
} else {
  // Handle /start & /stop first so brand-new subscribers get this cycle's alerts too.
  await processCommands(config.telegramToken, state);
  const recipients = [
    ...(config.telegramChannel ? [config.telegramChannel] : []),
    ...Object.keys(state.subscribers),
  ];
  for (const a of top) await broadcast(config.telegramToken, recipients, formatAlert(a));
  if (dropped > 0 && recipients.length && top.length) {
    await broadcast(config.telegramToken, recipients, `…plus ${dropped} more big moves this cycle.`);
  }
  console.log(`sent ${top.length} alerts to ${recipients.length} recipients`);
}

saveState(statePath, state);
console.log(
  `state saved (${statePath}): ${Object.keys(state.markets).length} tracked markets, ` +
    `${Object.keys(state.subscribers).length} subscribers`,
);

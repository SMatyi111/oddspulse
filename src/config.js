function num(name, def) {
  const v = process.env[name];
  return v !== undefined && v !== "" ? Number(v) : def;
}

function list(name, def) {
  const v = process.env[name];
  return v !== undefined && v !== "" ? v.split(",").map((s) => s.trim()).filter(Boolean) : def;
}

export const config = {
  // A market is tracked only if its 24h volume is at least this many contracts.
  minVol24h: num("ODDSPULSE_MIN_VOL24H", 500),
  // Alert when probability moves at least this many percentage points...
  movePp: num("ODDSPULSE_MOVE_PP", 10),
  // ...within this window.
  windowMin: num("ODDSPULSE_WINDOW_MIN", 60),
  // Skip markets whose bid/ask spread is wider than this (in dollars, 0..1) — quotes too noisy.
  maxSpread: num("ODDSPULSE_MAX_SPREAD", 0.10),
  // Skip markets closing sooner than this: prices near resolution sweep to 0/100 mechanically
  // (15-min/hourly crypto ladders, endgame markets) — that's time decay, not news.
  minMinutesToClose: num("ODDSPULSE_MIN_MINUTES_TO_CLOSE", 120),
  maxAlertsPerRun: num("ODDSPULSE_MAX_ALERTS", 8),
  // Re-alert the same market only after it moves another realertPp, or after the cooldown.
  realertPp: num("ODDSPULSE_REALERT_PP", 5),
  realertCooldownMin: num("ODDSPULSE_REALERT_COOLDOWN_MIN", 360),
  historyMaxMin: num("ODDSPULSE_HISTORY_MAX_MIN", 90),
  // Live sports odds swing constantly and would drown everything else out.
  excludedCategories: list("ODDSPULSE_EXCLUDED_CATEGORIES", ["Sports"]),
  // Continuous-underlying price/temperature ladders re-alert mechanically on every
  // wiggle of the underlying (BTC spot, nat gas, daily highs). That's price tracking,
  // not event news — matched by series-ticker prefix.
  excludedSeriesPrefixes: list("ODDSPULSE_EXCLUDED_SERIES_PREFIXES", [
    "KXBTC", "KXETH", "KXSOL", "KXXRP", "KXDOGE",
    "KXGOLD", "KXSILVER", "KXNATGAS", "KXBRENT", "KXWTI",
    "KXNASDAQ", "KXINX", "KXHIGH", "KXLOWT",
  ]),
  // At most one alert per series per cycle, and a series stays quiet after alerting.
  seriesCooldownMin: num("ODDSPULSE_SERIES_COOLDOWN_MIN", 120),
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",
  // Optional public channel (e.g. @oddspulse); the bot must be an admin there.
  telegramChannel: process.env.TELEGRAM_CHANNEL || "",
};

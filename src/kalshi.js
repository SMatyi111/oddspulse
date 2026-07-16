const BASE = "https://api.elections.kalshi.com/trade-api/v2";

const MAX_RETRY_AFTER_MS = 30_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(headers) {
  const value = headers?.get?.("retry-after");
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.min(Math.max(0, seconds * 1000), MAX_RETRY_AFTER_MS);
  }

  const retryAt = Date.parse(value);
  if (Number.isFinite(retryAt)) {
    return Math.min(Math.max(0, retryAt - Date.now()), MAX_RETRY_AFTER_MS);
  }
  return null;
}

function backoffMs(attempt) {
  return 1000 * (attempt + 1) ** 2;
}

// Retries only transient failures. A sweep remains all-or-nothing: callers get an
// error after the final failed page, so they never save partial market state.
export async function fetchJson(
  url,
  { tries = 5, fetchImpl = globalThis.fetch, wait = sleep, logger = console } = {},
) {
  let lastError;
  const maxAttempts = Math.max(1, tries);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetchImpl(url, { headers: { accept: "application/json" } });
      if (res.ok) return await res.json();

      const error = new Error(`Kalshi HTTP ${res.status} for ${url}`);
      if (res.status !== 429 && res.status < 500) {
        error.retryable = false;
      } else {
        error.retryAfterMs = retryAfterMs(res.headers);
      }
      throw error;
    } catch (error) {
      if (error?.retryable === false) throw error;

      lastError = error;
      if (attempt === maxAttempts - 1) break;

      const delay = error?.retryAfterMs ?? backoffMs(attempt);
      logger.warn(
        `Kalshi retry ${attempt + 1}/${maxAttempts}: ${error?.message || "request failed"}; retrying in ${delay}ms`,
      );
      await wait(delay);
    }
  }

  throw new Error(`Kalshi: retries exhausted after ${maxAttempts} attempts for ${url}`, {
    cause: lastError,
  });
}

// Yes-probability of a market: mid of bid/ask when the book is sane, else last trade.
export function probOf(m) {
  const bid = parseFloat(m.yes_bid_dollars);
  const ask = parseFloat(m.yes_ask_dollars);
  const last = parseFloat(m.last_price_dollars);
  if (bid > 0 && ask > 0 && ask >= bid) return (bid + ask) / 2;
  return Number.isFinite(last) ? last : NaN;
}

export function spreadOf(m) {
  const bid = parseFloat(m.yes_bid_dollars);
  const ask = parseFloat(m.yes_ask_dollars);
  if (!(bid > 0) || !(ask > 0) || ask < bid) return Infinity;
  return ask - bid;
}

// One full sweep of open events with nested markets, filtered down to liquid,
// tightly-quoted markets outside the excluded categories. ~35 pages / ~20s as of 2026-07.
export async function sweepLiquidMarkets(cfg) {
  let cursor = "";
  let pages = 0;
  const out = [];
  const minCloseTs = Date.now() + cfg.minMinutesToClose * 60_000;
  while (pages < 200) {
    const d = await fetchJson(
      `${BASE}/events?limit=200&status=open&with_nested_markets=true${cursor ? `&cursor=${cursor}` : ""}`,
    );
    pages++;
    for (const e of d.events || []) {
      if (cfg.excludedCategories.includes(e.category)) continue;
      const series = e.series_ticker || "";
      if (cfg.excludedSeriesPrefixes.some((p) => series.startsWith(p))) continue;
      for (const m of e.markets || []) {
        if (m.status !== "active") continue;
        const closeTs = Date.parse(m.close_time || "");
        if (Number.isFinite(closeTs) && closeTs < minCloseTs) continue;
        const vol24 = parseFloat(m.volume_24h_fp || "0");
        if (!(vol24 >= cfg.minVol24h)) continue;
        const prob = probOf(m);
        if (!Number.isFinite(prob)) continue;
        if (spreadOf(m) > cfg.maxSpread) continue;
        out.push({
          ticker: m.ticker,
          eventTicker: e.event_ticker,
          series: e.series_ticker || "",
          category: e.category || "",
          title: e.title || m.title || m.ticker,
          sub: m.yes_sub_title || "",
          prob,
          vol24,
        });
      }
    }
    cursor = d.cursor;
    if (!cursor || (d.events || []).length === 0) break;
  }
  return { markets: out, pages };
}

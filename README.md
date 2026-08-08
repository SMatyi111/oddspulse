# OddsPulse 📈

**Telegram alerts when prediction markets move sharply.**

OddsPulse watches every liquid market on [Kalshi](https://kalshi.com) (~4,000 markets across politics, economics, crypto, weather, entertainment…) and sends a Telegram alert when a market's probability jumps by **10+ percentage points within an hour**. A sharp odds move means *someone knows something* — news broke, a data release hit, or smart money repositioned. OddsPulse tells you which question moved, before you'd find it scrolling.

```
📈 Will the Fed cut rates in September?
34% → 51% (+17pp in 25 min)
24h volume: 182,400 · KXFEDCUT-26SEP on Kalshi
```

## How it works

- A GitHub Actions cron sweeps the public Kalshi API every ~5 minutes (~7,000 open events, filtered to markets with 24h volume ≥ 500 contracts and a tight bid/ask spread)
- Move detection compares against the oldest price sample inside a rolling 60-minute window — "+17pp in 25 min" means exactly that
- Live sports are excluded by default (in-game odds swing constantly and would drown out everything else)
- Duplicate suppression: a market re-alerts only after moving another 5pp, or after a 6-hour cooldown
- State lives on an orphan `state` branch — no database, no server, no cost

## Subscribe

- **[Start the OddsPulse bot](https://t.me/OddsPulseSMatyi111Bot?start=github)** — send `/start` for private alerts.
- **[Follow @oddspulse](https://t.me/oddspulse)** — see public alerts before subscribing.

## Self-host

Fork this repo and see [SETUP.md](SETUP.md). Runs entirely on the GitHub Actions free tier for public repos — zero infrastructure.

## Configuration

Everything is tunable via environment variables (see [src/config.js](src/config.js)):

| Variable | Default | Meaning |
|---|---|---|
| `ODDSPULSE_MOVE_PP` | 10 | Alert threshold, percentage points |
| `ODDSPULSE_WINDOW_MIN` | 60 | Rolling detection window, minutes |
| `ODDSPULSE_MIN_VOL24H` | 500 | Minimum 24h volume (contracts) to track a market |
| `ODDSPULSE_MAX_SPREAD` | 0.10 | Maximum bid/ask spread ($) — wider quotes are noise |
| `ODDSPULSE_MIN_MINUTES_TO_CLOSE` | 120 | Ignore markets closing sooner (resolution sweep ≠ news) |
| `ODDSPULSE_EXCLUDED_CATEGORIES` | Sports | Comma-separated category blocklist |
| `ODDSPULSE_MAX_ALERTS` | 8 | Alert cap per 5-minute cycle |

## Roadmap

- [ ] Polymarket coverage + **cross-venue divergence alerts** (same event priced differently on two venues)
- [ ] Per-user filters: categories, custom thresholds, watchlists (premium)
- [ ] Daily digest: biggest movers of the last 24h
- [ ] Public web dashboard of recent big moves

## Notes

- Zero runtime dependencies — plain Node 20+, `node --test` for the test suite
- OddsPulse is **read-only analytics** on public market data. It does not execute trades, route orders, or hold funds
- Not affiliated with Kalshi. Not investment advice

## License

MIT

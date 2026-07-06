// Pure move-detection logic. No I/O — fully unit-testable.
//
// state.markets[ticker] = {
//   title, sub, series, category,
//   hist: [[ts, prob], ...],            // pruned to cfg.historyMaxMin
//   lastAlert: { ts, prob } | null,     // dedup anchor
// }

// FP tolerance: 0.47 - 0.42 is 0.049999...96 in IEEE754; thresholds must not flake on that.
const EPS = 1e-9;

export function allowedByDedup(lastAlert, prob, now, cfg) {
  if (!lastAlert) return true;
  if (now - lastAlert.ts >= cfg.realertCooldownMin * 60_000) return true;
  return Math.abs(prob - lastAlert.prob) * 100 >= cfg.realertPp - EPS;
}

// Updates state in place with the new snapshot and returns ranked alerts.
export function updateAndDetect(state, snapshot, now, cfg) {
  const alerts = [];
  const windowMs = cfg.windowMin * 60_000;
  const histMaxMs = cfg.historyMaxMin * 60_000;
  const seen = new Set();

  for (const m of snapshot) {
    seen.add(m.ticker);
    const entry = (state.markets[m.ticker] ??= { hist: [], lastAlert: null });
    entry.title = m.title;
    entry.sub = m.sub;
    entry.series = m.series;
    entry.category = m.category;

    // Reference = oldest sample still inside the window: "moved X pp in Y min" stays honest.
    let ref = null;
    for (const [ts, p] of entry.hist) {
      if (now - ts <= windowMs) {
        ref = { ts, p };
        break; // hist is append-only chronological
      }
    }

    if (ref) {
      const deltaPp = (m.prob - ref.p) * 100;
      if (Math.abs(deltaPp) >= cfg.movePp - EPS && allowedByDedup(entry.lastAlert, m.prob, now, cfg)) {
        alerts.push({
          ticker: m.ticker,
          title: m.title,
          sub: m.sub,
          series: m.series,
          category: m.category,
          from: ref.p,
          to: m.prob,
          deltaPp,
          minutes: Math.max(1, Math.round((now - ref.ts) / 60_000)),
          vol24: m.vol24,
        });
        entry.lastAlert = { ts: now, prob: m.prob };
      }
    }

    entry.hist.push([now, m.prob]);
    entry.hist = entry.hist.filter(([ts]) => now - ts <= histMaxMs);
  }

  // Drop markets that disappeared (closed/illiquid) once their history has fully aged out.
  for (const t of Object.keys(state.markets)) {
    const e = state.markets[t];
    const lastTs = e.hist.length ? e.hist[e.hist.length - 1][0] : 0;
    if (!seen.has(t) && now - lastTs > histMaxMs) delete state.markets[t];
  }

  // Biggest move on the most liquid markets first.
  alerts.sort(
    (a, b) =>
      Math.abs(b.deltaPp) * Math.log10(b.vol24 + 10) -
      Math.abs(a.deltaPp) * Math.log10(a.vol24 + 10),
  );
  return alerts;
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { updateAndDetect, allowedByDedup } from "../src/detect.js";

const cfg = {
  movePp: 10,
  windowMin: 60,
  historyMaxMin: 90,
  realertPp: 5,
  realertCooldownMin: 360,
};

const MIN = 60_000;

function mkt(ticker, prob, vol24 = 5000) {
  return { ticker, title: `T ${ticker}`, sub: "", series: "KXTEST", category: "Politics", prob, vol24 };
}

function freshState() {
  return { markets: {} };
}

test("first sighting stores baseline, no alert", () => {
  const state = freshState();
  const alerts = updateAndDetect(state, [mkt("A", 0.3)], 0, cfg);
  assert.equal(alerts.length, 0);
  assert.equal(state.markets.A.hist.length, 1);
});

test("big move within window fires one alert with honest delta", () => {
  const state = freshState();
  updateAndDetect(state, [mkt("A", 0.3)], 0, cfg);
  const alerts = updateAndDetect(state, [mkt("A", 0.45)], 30 * MIN, cfg);
  assert.equal(alerts.length, 1);
  assert.ok(Math.abs(alerts[0].deltaPp - 15) < 1e-6);
  assert.equal(alerts[0].from, 0.3);
  assert.equal(alerts[0].to, 0.45);
  assert.equal(alerts[0].minutes, 30);
});

test("small move stays silent", () => {
  const state = freshState();
  updateAndDetect(state, [mkt("A", 0.3)], 0, cfg);
  const alerts = updateAndDetect(state, [mkt("A", 0.35)], 30 * MIN, cfg);
  assert.equal(alerts.length, 0);
});

test("slow drift outside the window does not alert", () => {
  const state = freshState();
  // +3pp every 30 min: 61+ min old points age out of the 60-min window
  let alerts = [];
  for (let i = 0; i <= 6; i++) {
    alerts = updateAndDetect(state, [mkt("A", 0.3 + i * 0.03)], i * 30 * MIN, cfg);
  }
  assert.equal(alerts.length, 0);
});

test("dedup: no re-alert until it moves another realertPp", () => {
  const state = freshState();
  updateAndDetect(state, [mkt("A", 0.3)], 0, cfg);
  let alerts = updateAndDetect(state, [mkt("A", 0.42)], 10 * MIN, cfg);
  assert.equal(alerts.length, 1);
  // +2pp more: suppressed even though window delta is still >= 10pp
  alerts = updateAndDetect(state, [mkt("A", 0.44)], 20 * MIN, cfg);
  assert.equal(alerts.length, 0);
  // +5pp beyond the last alerted price: fires again
  alerts = updateAndDetect(state, [mkt("A", 0.47)], 30 * MIN, cfg);
  assert.equal(alerts.length, 1);
});

test("dedup: cooldown expiry re-allows alerts", () => {
  const now = 0;
  assert.equal(allowedByDedup({ ts: now, prob: 0.4 }, 0.42, now + 10 * MIN, cfg), false);
  assert.equal(allowedByDedup({ ts: now, prob: 0.4 }, 0.42, now + 361 * MIN, cfg), true);
});

test("vanished markets are pruned after history ages out", () => {
  const state = freshState();
  updateAndDetect(state, [mkt("A", 0.3), mkt("B", 0.5)], 0, cfg);
  updateAndDetect(state, [mkt("A", 0.31)], 200 * MIN, cfg);
  assert.ok(state.markets.A);
  assert.equal(state.markets.B, undefined);
});

test("alerts ranked by move size times liquidity", () => {
  const state = freshState();
  updateAndDetect(state, [mkt("A", 0.3, 100_000), mkt("B", 0.3, 1000)], 0, cfg);
  const alerts = updateAndDetect(
    state,
    [mkt("A", 0.42, 100_000), mkt("B", 0.45, 1000)],
    10 * MIN,
    cfg,
  );
  assert.equal(alerts.length, 2);
  // B moved more (15pp vs 12pp) but A's 100x liquidity outweighs it
  assert.equal(alerts[0].ticker, "A");
});

test("history is pruned to historyMaxMin", () => {
  const state = freshState();
  for (let i = 0; i < 30; i++) {
    updateAndDetect(state, [mkt("A", 0.3)], i * 10 * MIN, cfg);
  }
  const oldest = state.markets.A.hist[0][0];
  const newest = state.markets.A.hist.at(-1)[0];
  assert.ok(newest - oldest <= cfg.historyMaxMin * MIN);
});

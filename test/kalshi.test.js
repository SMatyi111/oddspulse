import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchJson } from "../src/kalshi.js";

const quietLogger = { warn() {} };
const noWait = async () => {};

test("retries a transient HTTP failure", async () => {
  let calls = 0;
  const data = await fetchJson("https://example.test/events", {
    tries: 2,
    fetchImpl: async () => {
      calls++;
      return calls === 1
        ? new Response("temporary", { status: 503 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
    wait: noWait,
    logger: quietLogger,
  });

  assert.equal(calls, 2);
  assert.deepEqual(data, { ok: true });
});

test("retries a transient fetch exception", async () => {
  let calls = 0;
  const data = await fetchJson("https://example.test/events", {
    tries: 2,
    fetchImpl: async () => {
      calls++;
      if (calls === 1) throw new Error("socket reset");
      return new Response(JSON.stringify({ recovered: true }), { status: 200 });
    },
    wait: noWait,
    logger: quietLogger,
  });

  assert.equal(calls, 2);
  assert.deepEqual(data, { recovered: true });
});

test("does not retry an ordinary client error", async () => {
  let calls = 0;
  await assert.rejects(
    fetchJson("https://example.test/events", {
      tries: 5,
      fetchImpl: async () => {
        calls++;
        return new Response("bad request", { status: 400 });
      },
      wait: noWait,
      logger: quietLogger,
    }),
    /Kalshi HTTP 400/,
  );

  assert.equal(calls, 1);
});

test("reports the final transient failure", async () => {
  await assert.rejects(
    fetchJson("https://example.test/events", {
      tries: 2,
      fetchImpl: async () => new Response("unavailable", { status: 503 }),
      wait: noWait,
      logger: quietLogger,
    }),
    (error) => {
      assert.match(error.message, /retries exhausted after 2 attempts/);
      assert.match(error.cause.message, /Kalshi HTTP 503/);
      return true;
    },
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { processCommands } from "../src/telegram.js";

test("records a Telegram start-source without resetting the original subscription date", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.includes("getUpdates")) {
      return {
        json: async () => ({
          ok: true,
          result: [{
            update_id: 42,
            message: { chat: { id: 7 }, text: "/start github" },
          }],
        }),
      };
    }
    return { json: async () => ({ ok: true }) };
  };

  const state = {
    tgOffset: 0,
    subscribers: { "7": { since: 123 } },
  };
  await processCommands("test-token", state);

  assert.deepEqual(state.subscribers["7"], { since: 123, source: "github" });
  assert.equal(state.tgOffset, 43);
  assert.equal(requests.length, 2);
});

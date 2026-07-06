const API = "https://api.telegram.org";

export async function tg(token, method, payload) {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) console.error(`telegram ${method} failed:`, data.description || res.status);
  return data;
}

export function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatAlert(a) {
  const arrow = a.deltaPp > 0 ? "\u{1F4C8}" : "\u{1F4C9}";
  const pct = (p) => `${Math.round(p * 100)}%`;
  const sub = a.sub && a.sub !== a.title ? ` — ${esc(a.sub)}` : "";
  const sign = a.deltaPp > 0 ? "+" : "";
  const link = a.series
    ? `https://kalshi.com/markets/${a.series.toLowerCase()}`
    : "https://kalshi.com";
  return [
    `${arrow} <b>${esc(a.title)}</b>${sub}`,
    `${pct(a.from)} → <b>${pct(a.to)}</b> (${sign}${Math.round(a.deltaPp)}pp in ${a.minutes} min)`,
    `24h volume: ${Math.round(a.vol24).toLocaleString("en-US")} · <a href="${link}">${esc(a.ticker)} on Kalshi</a>`,
  ].join("\n");
}

export async function broadcast(token, chatIds, text) {
  for (const id of chatIds) {
    await tg(token, "sendMessage", {
      chat_id: id,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    await new Promise((r) => setTimeout(r, 50));
  }
}

const WELCOME = [
  "\u{1F514} <b>OddsPulse</b> — you're subscribed.",
  "You'll get an alert when a liquid Kalshi market moves ≥10 percentage points within an hour (sports excluded).",
  "Alerts are checked every ~5 minutes. /stop to unsubscribe.",
].join("\n");

const HELP = [
  "<b>OddsPulse</b> — sharp-move alerts for prediction markets.",
  "/start — subscribe",
  "/stop — unsubscribe",
  "Source: github.com/SMatyi111/oddspulse",
].join("\n");

// Poll pending bot commands (/start, /stop, /help). Mutates state.subscribers and state.tgOffset.
// Uses getUpdates, so the bot must NOT have a webhook configured.
export async function processCommands(token, state) {
  const d = await tg(token, "getUpdates", {
    offset: state.tgOffset || 0,
    timeout: 0,
    allowed_updates: ["message"],
  });
  if (!d.ok || !Array.isArray(d.result)) return;
  for (const u of d.result) {
    state.tgOffset = u.update_id + 1;
    const msg = u.message;
    if (!msg || !msg.text || !msg.chat) continue;
    const id = String(msg.chat.id);
    const cmd = msg.text.trim().split(/[\s@]+/)[0].toLowerCase();
    if (cmd === "/start") {
      state.subscribers[id] = { since: Date.now() };
      await tg(token, "sendMessage", { chat_id: id, text: WELCOME, parse_mode: "HTML" });
    } else if (cmd === "/stop") {
      delete state.subscribers[id];
      await tg(token, "sendMessage", { chat_id: id, text: "Alerts stopped. /start to resume." });
    } else if (cmd === "/help") {
      await tg(token, "sendMessage", { chat_id: id, text: HELP, parse_mode: "HTML" });
    }
  }
}

# Setup — from zero to live alerts in ~10 minutes

You need: a GitHub account (you have one) and Telegram. No server, no credit card.

## 1. Create the Telegram bot (2 min)

1. In Telegram, open **@BotFather** and send `/newbot`
2. Name: `OddsPulse` (display name), username: something like `oddspulse_bot` (must end in `bot`)
3. BotFather replies with a **token** like `1234567890:AAF...xyz` — copy it, treat it like a password
4. Optional polish via BotFather: `/setdescription` → "Alerts when prediction markets move sharply", `/setuserpic`

> Do **not** set a webhook for this bot anywhere — OddsPulse uses polling; a webhook would break it.

## 2. Add the token to the GitHub repo (1 min)

In this repo on GitHub: **Settings → Secrets and variables → Actions → New repository secret**

- Name: `TELEGRAM_BOT_TOKEN`
- Value: the token from BotFather

## 3. (Optional but recommended) Public channel

A public channel makes subscriber growth visible — useful proof for grant applications.

1. Telegram → New Channel → name it (e.g. **OddsPulse**), make it public with a handle like `@oddspulse`
2. Add your bot as an **administrator** of the channel (needs "Post messages" right)
3. In the repo: **Settings → Secrets and variables → Actions → Variables tab → New repository variable**
   - Name: `TELEGRAM_CHANNEL`, Value: `@oddspulse` (your channel handle)

## 4. Turn it on (1 min)

1. Repo → **Actions** tab → enable workflows if prompted
2. Open the **pulse** workflow → **Run workflow** (manual first run: builds the baseline, sends nothing)
3. Done. The cron now runs every ~5 minutes (GitHub sometimes delays scheduled runs a few minutes — normal)

## 5. Verify

- Send `/start` to your bot → within ~5–10 minutes (next cycle) it replies with the welcome message
- Check the Actions log of any run: you should see `swept 35 pages → ~1800 liquid markets`
- Alerts arrive whenever something actually moves — quiet days are quiet; big news days are loud

## Maintenance notes

- **Cron fallback (keep-alive chain):** GitHub often silently drops cron schedules on new repos. The pulse workflow therefore re-dispatches itself every ~5 minutes once started manually. To stop the chain: add repo variable `ODDSPULSE_CHAIN` = `off` (Settings → Secrets and variables → Actions → Variables). To restart it: remove the variable (or set anything else) and run **pulse** manually once. If the native schedule starts firing reliably (check the Actions tab for `schedule`-triggered runs), you can turn the chain off for good.
- **GitHub disables scheduled workflows after ~60 days without repo activity.** Any commit resets the clock — a README tweak counts. Set a monthly reminder.
- State lives on the `state` branch (single JSON file, force-pushed each run). Deleting that branch resets the bot's memory — it will re-baseline silently, nothing breaks.
- To tune thresholds, edit the `env` block in [.github/workflows/pulse.yml](.github/workflows/pulse.yml) using the variables from [README.md](README.md).

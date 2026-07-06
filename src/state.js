import { readFileSync, writeFileSync } from "node:fs";

export function loadState(path) {
  let raw = {};
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    // first run or corrupt state: start clean
  }
  return {
    version: 1,
    tgOffset: raw.tgOffset || 0,
    subscribers: raw.subscribers || {},
    markets: raw.markets || {},
    seriesAlert: raw.seriesAlert || {},
  };
}

export function saveState(path, state) {
  writeFileSync(path, JSON.stringify(state));
}

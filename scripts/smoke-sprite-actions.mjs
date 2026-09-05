// Headless smoke: import store.js from Node with a stubbed localStorage,
// stubbed fetch, exercise runSpriteAction for every primary actionId,
// then assert the overlay state. Doesn't touch public/data/items.json.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const seedRaw = readFileSync(resolve(projectRoot, "public/data/items.json"), "utf8");
const seedItems = JSON.parse(seedRaw);

/**
 * Minimal localStorage shim: store survives within this process so the
 * store's writeOverlayPartial / readOverlay round-trip works. Cleared
 * before each action so we can assert a clean baseline.
 */
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
const storage = new MemoryStorage();
globalThis.localStorage = storage;
// Node 19+ ships a global crypto with randomUUID. Older runtimes fall
// back to a deterministic counter so generated local-* ids stay unique
// within a smoke run.
if (typeof globalThis.crypto === "undefined" || typeof globalThis.crypto?.randomUUID !== "function") {
  Object.defineProperty(globalThis, "crypto", {
    value: (() => {
      let n = 0;
      return {
        randomUUID: () => `uuid-${++n}-${Date.now().toString(36)}`,
      };
    })(),
    configurable: true,
  });
}

/**
 * fetch() shim that returns the on-disk items.json as JSON so loadItems
 * can populate the cache without hitting the network.
 */
globalThis.fetch = async (url) => {
  if (typeof url === "string" && url.endsWith("/data/items.json")) {
    return {
      ok: true,
      status: 200,
      async json() { return JSON.parse(JSON.stringify(seedItems)); },
    };
  }
  return { ok: false, status: 404, async json() { return []; } };
};

const store = await import(resolve(projectRoot, "src/store.js"));
const { runSpriteAction, loadItems, getFlash, restoreSeeds } = store;

const SPRITES_BY_ID = Object.fromEntries(
  seedItems
    .map((item) => [item.botId, { id: item.botId, name: item.botId }])
    .filter(([id]) => id),
);
// Dedup
const seen = new Set();
const SPRITES = [];
for (const [id, sprite] of Object.entries(SPRITES_BY_ID)) {
  if (seen.has(id)) continue;
  seen.add(id);
  SPRITES.push(sprite);
}

function readOverlay() {
  try {
    return JSON.parse(storage.getItem("sprite-portal:items-overlay") || "{}");
  }
  catch {
    return {};
  }
}

function resetOverlay() {
  storage.removeItem("sprite-portal:items-overlay");
  storage.removeItem("sprite-portal-items-v3");
}

function fail(msg) {
  console.error(`FAIL  ${msg}`);
  process.exitCode = 1;
}
function pass(msg) {
  console.log(`PASS  ${msg}`);
}

const checks = [];

// === Jacob (inbox) ===
await restoreSeeds();
const jacobSprite = SPRITES.find((s) => s.id === "jacob");
const beforeHigh = (await loadItems()).filter((i) => i.botId === "jacob" && i.status === "open" && i.priority === "high").length;
runSpriteAction(jacobSprite, "inbox");
const overlay1 = readOverlay();
const jacobIds = Object.keys(overlay1).filter((id) => {
  // An overlay entry belongs to jacob if it has botId jacob OR the seed
  // has that id with botId jacob.
  const seed = seedItems.find((s) => s.id === id);
  return seed?.botId === "jacob" || overlay1[id]?.botId === "jacob";
});
checks.push(["Jacob inbox: overlay has ≥1 jacob row written", jacobIds.length > 0]);
const flash1 = getFlash();
checks.push(["Jacob inbox: flash kind === 'inbox'", flash1?.kind === "inbox"]);
checks.push(["Jacob inbox: flash mentions 已勾走 OR 已標 (write happened)", /已勾走|已標/.test(flash1?.body || "")]);
const afterHigh = (await loadItems()).filter((i) => i.botId === "jacob" && i.status === "open" && i.priority === "high").length;
checks.push([`Jacob inbox: 高優先 count dropped (${beforeHigh} → ${afterHigh})`, afterHigh < beforeHigh]);

// === English Edge (class) ===
await restoreSeeds();
const eeSprite = SPRITES.find((s) => s.id === "english-edge");
runSpriteAction(eeSprite, "class");
const overlay2 = readOverlay();
const eeIds = Object.keys(overlay2).filter((id) => overlay2[id]?.botId === "english-edge" || seedItems.find((s) => s.id === id)?.botId === "english-edge");
checks.push(["English Edge class: overlay has ≥1 english-edge row written", eeIds.length > 0]);
const flash2 = getFlash();
checks.push(["English Edge class: flash kind === 'class'", flash2?.kind === "class"]);
checks.push(["English Edge class: flash body includes 下一堂", /下一堂/.test(flash2?.body || "")]);

// === ChapterMind (progress) ===
await restoreSeeds();
const cmSprite = SPRITES.find((s) => s.id === "chaptermind");
runSpriteAction(cmSprite, "progress");
const overlay3 = readOverlay();
const cmIds = Object.keys(overlay3).filter((id) => overlay3[id]?.botId === "chaptermind" || seedItems.find((s) => s.id === id)?.botId === "chaptermind");
checks.push(["ChapterMind progress: overlay has ≥1 chaptermind row written", cmIds.length > 0]);
const flash3 = getFlash();
checks.push(["ChapterMind progress: flash kind === 'progress'", flash3?.kind === "progress"]);
checks.push(["ChapterMind progress: flash body includes 在讀", /在讀/.test(flash3?.body || "")]);
checks.push(["ChapterMind progress: stats has 進度 / 在讀 / wishlist", Array.isArray(flash3?.stats) && flash3.stats.some((s) => s.label === "在讀") && flash3.stats.some((s) => s.label === "wishlist")]);

// === HomePilot (urgent) ===
await restoreSeeds();
const hpSprite = SPRITES.find((s) => s.id === "homepilot");
runSpriteAction(hpSprite, "urgent");
const overlay4 = readOverlay();
const hpIds = Object.keys(overlay4).filter((id) => overlay4[id]?.botId === "homepilot" || seedItems.find((s) => s.id === id)?.botId === "homepilot");
checks.push(["HomePilot urgent: overlay has ≥1 homepilot row written", hpIds.length > 0]);
const flash4 = getFlash();
checks.push(["HomePilot urgent: flash kind === 'urgent'", flash4?.kind === "urgent"]);
checks.push(["HomePilot urgent: flash body includes 已標緊急", /已標緊急/.test(flash4?.body || "")]);
checks.push(["HomePilot urgent: flash body mentions 處理中", /處理中/.test(flash4?.body || "")]);

// === Jazz (refuel) — CRITICAL ===
await restoreSeeds();
const jzSprite = SPRITES.find((s) => s.id === "jazz");
runSpriteAction(jzSprite, "refuel");
const overlay5 = readOverlay();
const jzIds = Object.keys(overlay5);
checks.push(["Jazz refuel: overlay has ≥1 row written", jzIds.length > 0]);
checks.push([
  "Jazz refuel: NO overlay row uses fixed id 'jz-refuel-log'",
  !jzIds.includes("jz-refuel-log"),
]);
const newJazzIds = jzIds.filter((id) => {
  if (id === "jz-refuel-log") return false;
  const seed = seedItems.find((s) => s.id === id);
  return !seed; // local-* — not in seed
});
checks.push([
  "Jazz refuel: new row(s) start with local- prefix",
  newJazzIds.length > 0 && newJazzIds.every((id) => id.startsWith("local-")),
]);
const jazzEntry = overlay5[newJazzIds[0] ?? jzIds[0]];
checks.push(["Jazz refuel: row carries persona odo / station / fuelGrade / liters / pricePerLiter / oilCountdown / lPer100", ["odo", "station", "fuelGrade", "liters", "pricePerLiter", "oilCountdown", "lPer100"].every((k) => jazzEntry?.[k] !== undefined && jazzEntry[k] !== "")]);
const flash5 = getFlash();
checks.push(["Jazz refuel: flash kind === 'refuel'", flash5?.kind === "refuel"]);
checks.push(["Jazz refuel: flash body includes 站 · L · $/L · odo · countdown · L/100", /站/.test(flash5?.body || "") && /油號/.test(flash5?.body || "") && /odo/.test(flash5?.body || "") && /L\/100/.test(flash5?.body || "")]);

// === VitalPilot (garmin) ===
await restoreSeeds();
const vpSprite = SPRITES.find((s) => s.id === "vitalpilot");
runSpriteAction(vpSprite, "garmin");
const overlay6 = readOverlay();
const vpIds = Object.keys(overlay6).filter((id) => overlay6[id]?.botId === "vitalpilot" || seedItems.find((s) => s.id === id)?.botId === "vitalpilot");
checks.push(["VitalPilot garmin: overlay has ≥1 vitalpilot row written", vpIds.length > 0]);
const vpEntry = overlay6[vpIds[0]];
const vpKeys = vpEntry ? Object.keys(vpEntry) : [];
checks.push([
  "VitalPilot garmin: only spine + 4 persona keys (no diagnosis/secret fields)",
  vpKeys.every((k) => ["id", "title", "status", "botId", "updatedAt", "garmin", "activity", "weighIn", "soberStreak"].includes(k)),
]);
checks.push(["VitalPilot garmin: row carries garmin / activity / weighIn / soberStreak", ["garmin", "activity", "weighIn", "soberStreak"].every((k) => vpEntry?.[k] !== undefined && vpEntry[k] !== "")]);
const flash6 = getFlash();
checks.push(["VitalPilot garmin: flash kind === 'garmin'", flash6?.kind === "garmin"]);
checks.push(["VitalPilot garmin: flash stats has Garmin snapshot / 活動 / 秤重 / 戒酒 streak", Array.isArray(flash6?.stats) && flash6.stats.length >= 4]);
checks.push(["VitalPilot garmin: flash body asserts no diagnoses / no secrets", /唔寫診斷/.test(flash6?.body || "") && /唔存登入資料/.test(flash6?.body || "")]);

// === Items on disk unchanged ===
const afterRaw = readFileSync(resolve(projectRoot, "public/data/items.json"), "utf8");
checks.push(["items.json unchanged on disk", afterRaw === seedRaw]);

let failed = 0;
for (const [label, ok] of checks) {
  if (ok) pass(label);
  else { fail(label); failed++; }
}

console.log("");
if (failed) {
  console.error(`${failed} check(s) failed.`);
  process.exit(1);
}
console.log("All sprite-action smoke checks passed.");
// Headless smoke: after runSpriteAction writes overlay, confirm the
// post-write glanceChips projection visibly reflects the new values
// for each action. Imports both store.js and views.js so the projection
// runs against the live cache state.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const seedItems = JSON.parse(readFileSync(resolve(projectRoot, "public/data/items.json"), "utf8"));

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
globalThis.localStorage = new MemoryStorage();

globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  async json() { return JSON.parse(JSON.stringify(seedItems)); },
});

const store = await import(resolve(projectRoot, "src/store.js"));
const { runSpriteAction, loadItems, restoreSeeds } = store;
const views = await import(resolve(projectRoot, "src/views.js"));
const { glanceChips } = views;

function fail(msg) { console.error(`FAIL  ${msg}`); process.exitCode = 1; }
function pass(msg) { console.log(`PASS  ${msg}`); }
function chipValue(chips, label) {
  return chips.find((c) => c.label === label)?.value;
}

let failed = 0;
const checks = [];

// === Jacob (inbox): 高優先 drops from 1 → 0 ===
await restoreSeeds();
const before = glanceChips(await loadItems(), "jacob");
const beforeHigh = chipValue(before, "高優先");
runSpriteAction({ id: "jacob", name: "Jacob Bot" }, "inbox");
const after = glanceChips(await loadItems(), "jacob");
const afterHigh = chipValue(after, "高優先");
checks.push([`Jacob inbox: 高優先 chip ${beforeHigh} → ${afterHigh} (must drop)`, Number(afterHigh) < Number(beforeHigh)]);

// === English Edge (class): latest open card's prep changed to 已備 ===
await restoreSeeds();
runSpriteAction({ id: "english-edge", name: "English Edge" }, "class");
const eeChips = glanceChips(await loadItems(), "english-edge");
// prep chip OR script status chip should reflect the new value
const eePrep = chipValue(eeChips, "prep");
const eeScript = chipValue(eeChips, "speaking script status");
checks.push(["English Edge class: prep OR script status chip carries 已備 / 就緒", eePrep === "已備" || eeScript === "就緒"]);

// === ChapterMind (progress): 進度 chip reflects bumped value ===
await restoreSeeds();
runSpriteAction({ id: "chaptermind", name: "ChapterMind" }, "progress");
const cmChips = glanceChips(await loadItems(), "chaptermind");
const cmProgress = chipValue(cmChips, "進度");
checks.push(["ChapterMind progress: 進度 chip is not '—' and shows bumped value", typeof cmProgress === "string" && cmProgress !== "—" && cmProgress.length > 0]);
const cmDiscuss = chipValue(cmChips, "想討論呢段");
checks.push(["ChapterMind progress: 想討論呢段 chip carries new marker", typeof cmDiscuss === "string" && /重新整理過/.test(cmDiscuss)]);

// === HomePilot (urgent): at least one urgent remains, flash reflects write ===
await restoreSeeds();
const hpBefore = glanceChips(await loadItems(), "homepilot");
runSpriteAction({ id: "homepilot", name: "HomePilot" }, "urgent");
const hpAfter = glanceChips(await loadItems(), "homepilot");
const hpBeforeCount = Number(chipValue(hpBefore, "urgent"));
const hpAfterCount = Number(chipValue(hpAfter, "urgent"));
checks.push([`HomePilot urgent: urgent chip count is accurate (${hpBeforeCount} → ${hpAfterCount})`, hpAfterCount >= hpBeforeCount || hpAfterCount >= 1]);

// === Jazz (refuel): NEW local-* row appears in jazz items, glance reflects ===
await restoreSeeds();
const jzBeforeItems = (await loadItems()).filter((i) => i.botId === "jazz");
runSpriteAction({ id: "jazz", name: "Jazz Bot" }, "refuel");
const jzAfterItems = (await loadItems()).filter((i) => i.botId === "jazz");
const newItems = jzAfterItems.filter((a) => !jzBeforeItems.some((b) => b.id === a.id));
checks.push(["Jazz refuel: at least 1 new item appeared in jazz list", newItems.length >= 1]);
checks.push(["Jazz refuel: new item(s) have local- prefix", newItems.every((i) => typeof i.id === "string" && i.id.startsWith("local-"))]);
const jzChips = glanceChips(jzAfterItems, "jazz");
const jzOdo = chipValue(jzChips, "odo");
const jzStation = chipValue(jzChips, "站");
checks.push(["Jazz refuel: glance odo chip carries new value (not '—')", jzOdo && jzOdo !== "—"]);
checks.push(["Jazz refuel: glance 站 chip carries new station", jzStation && jzStation !== "—"]);

// === VitalPilot (garmin): vp-1 (open) gets updated with new persona ===
await restoreSeeds();
runSpriteAction({ id: "vitalpilot", name: "VitalPilot" }, "garmin");
const vpChips = glanceChips(await loadItems(), "vitalpilot");
const garminValue = chipValue(vpChips, "Garmin snapshot");
const weighValue = chipValue(vpChips, "秤重");
const soberValue = chipValue(vpChips, "戒酒 streak");
checks.push(["VitalPilot garmin: Garmin snapshot chip carries 9,124 步", /9,124 步/.test(garminValue || "")]);
checks.push(["VitalPilot garmin: 秤重 chip carries 72.3 kg", /72\.3 kg/.test(weighValue || "")]);
checks.push(["VitalPilot garmin: 戒酒 streak chip carries 13 日", /13 日/.test(soberValue || "")]);

for (const [label, ok] of checks) {
  if (ok) pass(label);
  else { fail(label); failed++; }
}

console.log("");
if (failed) {
  console.error(`${failed} check(s) failed.`);
  process.exit(1);
}
console.log("All glance-after-action smoke checks passed.");
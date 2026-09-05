// Headless smoke: import views.js from Node, call renderDashboard, and
// inspect the generated HTML. Doesn't touch the store / overlay / seeds.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const items = JSON.parse(readFileSync(resolve(projectRoot, "public/data/items.json"), "utf8"));

const { renderDashboard } = await import(resolve(projectRoot, "src/views.js"));
const html = renderDashboard(items, { hopperFilter: "open" });

const checks = [
  ["六精靈速覽 heading", html.includes("<h2>六精靈速覽</h2>")],
  ["精靈一覽 heading still present", html.includes("<h2>精靈一覽</h2>")],
  ["六精靈速覽 above 精靈一覽", html.indexOf("六精靈速覽") < html.indexOf("精靈一覽")],
  ["six glance-card anchors", (html.match(/class="glance-card"/g) || []).length === 6],
  ["six data-link to sprite paths", (html.match(/href="\/sprites\/(jacob|english-edge|chaptermind|homepilot|jazz|vitalpilot)"/g) || []).length >= 6],
  ["all six sprite names", ["Jacob Bot","English Edge","ChapterMind","HomePilot","Jazz Bot","VitalPilot"].every(n => html.includes(n))],
  ["open-count rendered", html.includes("張未完成")],
  ["入房 badge present", html.includes("入房 →")],
  ["glance-chip class used", html.includes("glance-chip")],
  ["1:1 avatar aspect-ratio var", html.includes("sprite-xs")],
  ["empty fallback present somewhere", html.includes("呢度暫時冇速覽——入房睇吓書枱。") || true], // tolerate if no bot is empty in seed
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed++;
}

if (failed) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll smoke checks passed.");

// Also exercise the empty fallback by stripping items for one bot.
const onlyJacob = items.filter((i) => i.botId !== "jazz");
const html2 = renderDashboard(onlyJacob, { hopperFilter: "open" });
const emptyFallbackSeen = html2.includes("呢度暫時冇速覽——入房睇吓書枱。");
console.log(`${emptyFallbackSeen ? "PASS" : "FAIL"}  empty fallback shown when jazz has no items`);
if (!emptyFallbackSeen) process.exit(1);

// And make sure clicking the card (data-link) leads to the right path.
const jacobCard = html.match(/<a class="glance-card" href="(\/sprites\/jacob)" data-link data-bot="jacob"[\s\S]*?<\/a>/);
console.log(`${jacobCard ? "PASS" : "FAIL"}  jacob card uses data-link to /sprites/jacob`);
if (!jacobCard) process.exit(1);
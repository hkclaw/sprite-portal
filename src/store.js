import { asItem, isOpen } from "./schema.js";

const ITEMS_URL = "/data/items.json";
/** Partial overlay: { [id]: { status, updatedAt, ...changed fields } } */
const OVERLAY_KEY = "sprite-portal:items-overlay";
/** Legacy full-dump key from earlier builds — ignored on load, cleared on restore. */
const LEGACY_KEY = "sprite-portal-items-v3";

/** @type {import("./schema.js").SpriteItem[] | null} */
let cache = null;

/** @type {{ spriteId?: string, kind?: string, title?: string, body?: string, stats?: { label: string, value: string }[] } | null} */
let flash = null;

function nowIso() {
  return new Date().toISOString();
}

function shiftDue(due, days) {
  const base = due ? new Date(`${due}T12:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + days);
    return fallback.toISOString().slice(0, 10);
  }
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function todayYmd() {
  const now = new Date();
  const tz = now.getTimezoneOffset() * 60000;
  return new Date(now - tz).toISOString().slice(0, 10);
}

function generateLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** @returns {Record<string, Record<string, unknown>>} */
function readOverlay() {
  try {
    const raw = localStorage.getItem(OVERLAY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    /** @type {Record<string, Record<string, unknown>>} */
    const out = {};
    for (const [id, partial] of Object.entries(parsed)) {
      if (partial && typeof partial === "object" && !Array.isArray(partial)) {
        out[id] = /** @type {Record<string, unknown>} */ (partial);
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** @param {string} id @param {Record<string, unknown>} partial */
function writeOverlayPartial(id, partial) {
  if (!id || !partial || !Object.keys(partial).length) return;
  try {
    const overlay = readOverlay();
    overlay[id] = { ...(overlay[id] || {}), ...partial };
    localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay));
  } catch {
    /* ignore quota / private-mode */
  }
}

/**
 * Merge seed items with overlay partials. Overlay-only ids (local adds) are prepended.
 * @param {import("./schema.js").SpriteItem[]} seed
 * @param {Record<string, Record<string, unknown>>} overlay
 */
function mergeSeed(seed, overlay) {
  const seedIds = new Set(seed.map((item) => item.id).filter(Boolean));
  const merged = seed.map((item) => {
    const partial = overlay[item.id];
    return partial ? asItem({ ...item, ...partial }) : item;
  });

  for (const [id, partial] of Object.entries(overlay)) {
    if (!id || seedIds.has(id)) continue;
    merged.unshift(asItem({ id, ...partial }));
  }
  return merged;
}

async function fetchSeed() {
  const response = await fetch(ITEMS_URL);
  const raw = response.ok ? await response.json() : [];
  return Array.isArray(raw) ? raw.map(asItem) : [];
}

export async function loadItems() {
  if (cache) return cache;
  try {
    const seed = await fetchSeed();
    cache = mergeSeed(seed, readOverlay());
  } catch {
    const overlay = readOverlay();
    cache = Object.keys(overlay).length
      ? mergeSeed([], overlay)
      : [];
  }
  return cache;
}

/**
 * Clear local overlay and reload from seeded items.json.
 * @returns {Promise<import("./schema.js").SpriteItem[]>}
 */
export async function restoreSeeds() {
  try {
    localStorage.removeItem(OVERLAY_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
  cache = null;
  clearFlash();
  return loadItems();
}

export function getFlash() {
  return flash;
}

export function clearFlash() {
  flash = null;
}

function setFlash(next) {
  flash = next;
}

/** @param {string} id @param {Record<string, unknown>} patch */
function patchItem(id, patch) {
  const stamped = { ...patch, updatedAt: nowIso() };
  const items = cache ?? [];
  const next = items.map((item) =>
    item.id === id ? asItem({ ...item, ...stamped }) : item,
  );
  cache = next;
  writeOverlayPartial(id, stamped);
  return next;
}

/** @param {string} botId */
export async function itemsForBot(botId) {
  const items = await loadItems();
  return items.filter((item) => item.botId === botId);
}

export function openItems(items) {
  return items.filter(isOpen);
}

export function openCountFor(botId, items) {
  return items.filter((item) => item.botId === botId && isOpen(item)).length;
}

export function completeItem(id) {
  const item = (cache ?? []).find((entry) => entry.id === id);
  /** @type {Record<string, unknown>} */
  const patch = { status: "done" };
  if (item?.botId === "homepilot") patch.houseStatus = "完成";
  const updated = patchItem(id, patch);
  setFlash({
    spriteId: item?.botId,
    kind: "complete",
    title: "完成",
    body: item ? `「${item.title}」已勾走。` : "卡片已勾走。",
  });
  return updated;
}

export function snoozeItem(id) {
  const item = (cache ?? []).find((entry) => entry.id === id);
  /** @type {Record<string, unknown>} */
  const patch = { status: "snoozed" };
  if (typeof item?.deadline === "string") {
    patch.deadline = shiftDue(item.deadline, 1);
  }
  if (typeof item?.due === "string") {
    patch.due = shiftDue(item.due, 1);
    patch.when = "Today";
  }
  if (typeof item?.nextClass === "string" && /^\d{4}-\d{2}-\d{2}/.test(item.nextClass)) {
    patch.nextClass = shiftDue(item.nextClass.slice(0, 10), 1);
  }
  const updated = patchItem(id, patch);
  setFlash({
    spriteId: item?.botId,
    kind: "snooze",
    title: "延後",
    body: item ? `「${item.title}」延到聽日再睇。` : "卡片延到聽日再睇。",
  });
  return updated;
}

function firstOpenId(botId) {
  return (cache ?? []).find((item) => item.botId === botId && isOpen(item))?.id ?? null;
}

export function completeFirstOpen(botId) {
  const id = firstOpenId(botId);
  if (!id) {
    setFlash({ spriteId: botId, kind: "complete", title: "完成", body: "沒有未完成的卡片。" });
    return cache ?? [];
  }
  return completeItem(id);
}

export function snoozeFirstOpen(botId) {
  const id = firstOpenId(botId);
  if (!id) {
    setFlash({ spriteId: botId, kind: "snooze", title: "延後", body: "沒有可延後的卡片。" });
    return cache ?? [];
  }
  return snoozeItem(id);
}

/**
 * Map optional due date onto persona-specific fields without changing the schema.
 * Returns a partial of persona fields to merge into the new item.
 * @param {string} botId
 * @param {string} due
 */
function personaFieldsForDue(botId, due) {
  if (!due) return {};
  /** @type {Record<string, unknown>} */
  const out = {};
  const today = todayYmd();
  if (botId === "jacob") {
    out.due = due;
    if (due === today) out.when = "Today";
  } else if (botId === "english-edge") {
    out.nextClass = due;
  } else if (botId === "homepilot") {
    out.deadline = due;
  }
  return out;
}

function addItem(partial) {
  const id = partial.id || generateLocalId();
  const item = asItem({
    ...partial,
    id,
    updatedAt: nowIso(),
  });
  cache = [item, ...(cache ?? []).filter((entry) => entry.id !== item.id)];
  // Local-only rows must live entirely in the overlay so they survive refresh.
  writeOverlayPartial(item.id, { ...item });
  return item;
}

/**
 * Public add: creates a local item for the given sprite and flashes the result.
 * @param {{ botId: string, title: string, due?: string }} payload
 * @returns {import("./schema.js").SpriteItem | null}
 */
export function addLocalItem({ botId, title, due }) {
  const cleanTitle = typeof title === "string" ? title.trim() : "";
  if (!botId || !cleanTitle) return null;

  const persona = personaFieldsForDue(botId, typeof due === "string" ? due : "");
  const item = addItem({
    botId,
    title: cleanTitle,
    status: "open",
    ...persona,
  });

  setFlash({
    spriteId: botId,
    kind: "add",
    title: "已加事項",
    body: `「${item.title}」已加到書枱。`,
  });

  return item;
}

/** Sprite-specific mock handlers that leave a visible, branded result. */
export function runSpriteAction(sprite, actionId) {
  const botId = sprite.id;

  if (actionId === "inbox") {
    const open = (cache ?? []).filter((item) => item.botId === botId && isOpen(item));
    const work = open.filter((item) => item.list === "Work").length;
    const personal = open.filter((item) => item.list === "Personal").length;
    const today = open.filter((item) => item.when === "Today").length;
    const overdue = open.filter((item) => item.when === "Overdue").length;
    const high = open.filter((item) => item.priority === "high").length;
    setFlash({
      spriteId: botId,
      kind: "inbox",
      title: "執漏收件箱",
      body: `TickTick Work ${work} / Personal ${personal}。Today ${today} · Overdue ${overdue}。優先高 ${high} 張。到期最早：${open[0]?.due || "—"}。`,
    });
    return cache ?? [];
  }

  if (actionId === "class") {
    const next = (cache ?? []).find((item) => item.botId === botId && isOpen(item));
    setFlash({
      spriteId: botId,
      kind: "class",
      title: "今日課堂",
      body: next
        ? `下一堂 ${next.nextClass || "—"}。grammar：${next.grammar || "—"}。vocab：${next.vocab || "—"}。speaking script status：${next.scriptStatus || "—"}。prep：${next.prep || "—"}。`
        : "冇未完成嘅課堂卡。",
    });
    return cache ?? [];
  }

  if (actionId === "progress") {
    const books = (cache ?? []).filter((item) => item.botId === botId);
    const reading = books.filter((item) => item.shelf === "在讀");
    const wishlist = books.filter((item) => item.shelf === "wishlist");
    setFlash({
      spriteId: botId,
      kind: "progress",
      title: "閱讀進度",
      body: reading[0]
        ? `在讀「${reading[0].title}」· ${reading[0].progress || "—"}。想討論呢段：${reading[0].discuss || "—"}`
        : "書架暫時空住。",
      stats: [
        { label: "在讀", value: String(reading.length) },
        { label: "wishlist", value: String(wishlist.length) },
        { label: "進度", value: reading[0]?.progress ? String(reading[0].progress) : "—" },
      ],
    });
    return cache ?? [];
  }

  if (actionId === "urgent") {
    const urgent = (cache ?? []).filter(
      (item) => item.botId === botId && isOpen(item) && item.urgent === true,
    );
    setFlash({
      spriteId: botId,
      kind: "urgent",
      title: "家居緊急",
      body: urgent[0]
        ? `先處理：${urgent[0].title}（${urgent[0].category || "類別 —"} · 供應商 ${urgent[0].vendor || "—"} · deadline ${urgent[0].deadline || "—"} · 狀態 ${urgent[0].houseStatus || "—"}）`
        : "冇標成緊急嘅家務。",
    });
    return cache ?? [];
  }

  if (actionId === "refuel") {
    addItem({
      id: "jz-refuel-log",
      title: "入油紀錄",
      status: "done",
      botId,
      odo: "43,020 km",
      station: "加德士黃竹坑",
      fuelGrade: "98",
      liters: "36.4",
      pricePerLiter: "16.9",
      oilCountdown: "980 km",
      lPer100: "7.1",
    });
    setFlash({
      spriteId: botId,
      kind: "refuel",
      title: "入油",
      body: "入油已記。站 加德士黃竹坑 · 油號 98 · 36.4 L · $16.9/L。odo 43,020 km · 換油 countdown 980 km · 7.1 L/100。",
    });
    return cache ?? [];
  }

  if (actionId === "garmin") {
    const live = (cache ?? []).find((item) => item.botId === botId && item.garmin);
    setFlash({
      spriteId: botId,
      kind: "garmin",
      title: "Garmin snapshot",
      body: "只記活動同習慣——唔寫診斷，亦唔存登入資料。",
      stats: [
        { label: "Garmin snapshot", value: String(live?.garmin || "8,432 步 · 42 分鐘") },
        { label: "活動", value: String(live?.activity || "Activity Monitor · 港灣圈") },
        { label: "秤重", value: String(live?.weighIn || "72.4 kg") },
        { label: "戒酒 streak", value: String(live?.soberStreak || "12 日") },
      ],
    });
    return cache ?? [];
  }

  setFlash({
    spriteId: botId,
    kind: actionId,
    title: sprite.name,
    body: "已記下呢個動作。",
  });
  return cache ?? [];
}

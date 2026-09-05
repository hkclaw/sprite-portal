import { asItem, isOpen } from "./schema.js";

const ITEMS_URL = "/data/items.json";
const STORAGE_KEY = "sprite-portal-items-v1";

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

function readOverlay() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.items) ? parsed.items.map(asItem) : null;
  } catch {
    return null;
  }
}

function persist(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items }));
  } catch {
    /* ignore quota / private-mode */
  }
}

function mergeSeed(seed, overlay) {
  if (!overlay?.length) return seed;
  const byId = new Map(seed.map((item) => [item.id, item]));
  for (const item of overlay) {
    if (item.id) byId.set(item.id, item);
  }
  return [...byId.values()];
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
    cache = readOverlay() ?? [];
  }
  return cache;
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

function commit(items) {
  cache = items;
  persist(items);
  return items;
}

function patchItem(id, patch) {
  const items = cache ?? [];
  const next = items.map((item) =>
    item.id === id ? asItem({ ...item, ...patch, updatedAt: nowIso() }) : item,
  );
  return commit(next);
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
  const updated = patchItem(id, { status: "done" });
  setFlash({
    spriteId: item?.botId,
    kind: "complete",
    title: "完成",
    body: item ? `「${item.title}」已勾掉。` : "Item marked done.",
  });
  return updated;
}

export function snoozeItem(id) {
  const item = (cache ?? []).find((entry) => entry.id === id);
  const updated = patchItem(id, {
    status: "snoozed",
    due: shiftDue(item?.due, 1),
  });
  setFlash({
    spriteId: item?.botId,
    kind: "snooze",
    title: "延後",
    body: item ? `「${item.title}」延到明天再看。` : "Item snoozed until tomorrow.",
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

function addItem(partial) {
  const item = asItem({
    priority: "normal",
    tags: [],
    ...partial,
    id: partial.id || `local-${Date.now()}`,
    updatedAt: nowIso(),
  });
  return commit([item, ...(cache ?? []).filter((entry) => entry.id !== item.id)]);
}

/** Sprite-specific mock handlers that leave a visible, branded result. */
export function runSpriteAction(sprite, actionId) {
  const botId = sprite.id;

  if (actionId === "inbox") {
    const open = (cache ?? []).filter((item) => item.botId === botId && isOpen(item));
    const high = open.filter((item) => item.priority === "high").length;
    setFlash({
      spriteId: botId,
      kind: "inbox",
      title: "Inbox sweep",
      body: `${open.length} open · ${high} starred. Amber flags stay at the top.`,
    });
    return cache ?? [];
  }

  if (actionId === "class") {
    setFlash({
      spriteId: botId,
      kind: "class",
      title: "今日課堂",
      body: "Conversation café — bakery counter. Warm-up, then two role plays. Target phrases: “I’d like…” / “Could I have…”.",
    });
    return cache ?? [];
  }

  if (actionId === "progress") {
    setFlash({
      spriteId: botId,
      kind: "progress",
      title: "閱讀進度",
      body: "North Station ch.4 is the live thread. Harbor Notes stays a paper outline.",
      stats: [
        { label: "North Station", value: "Ch 4 · 62%" },
        { label: "Harbor Notes", value: "Outline · 40%" },
        { label: "Loose threads", value: "3 open" },
      ],
    });
    return cache ?? [];
  }

  if (actionId === "urgent") {
    const urgent = (cache ?? []).filter(
      (item) => item.botId === botId && isOpen(item) && item.priority === "high",
    );
    setFlash({
      spriteId: botId,
      kind: "urgent",
      title: "家居緊急",
      body: urgent[0]
        ? `先處理：${urgent[0].title}`
        : "沒有標成高優先的家務。陽台植物仍值得看一眼。",
    });
    return cache ?? [];
  }

  if (actionId === "refuel") {
    addItem({
      id: "jz-refuel-log",
      title: "入油紀錄",
      status: "done",
      botId,
      tags: ["入油"],
      notes: "Mock fill-up logged from the Jazz Bot desk.",
      priority: "low",
    });
    setFlash({
      spriteId: botId,
      kind: "refuel",
      title: "入油",
      body: "油箱已補。今晚路程無憂 — jazz blue night, full tank.",
    });
    return cache ?? [];
  }

  if (actionId === "garmin") {
    setFlash({
      spriteId: botId,
      kind: "garmin",
      title: "Garmin snapshot",
      body: "A gentle week. Keep the evening stroll; skip the heroics.",
      stats: [
        { label: "Steps", value: "8,432" },
        { label: "Move", value: "42 min" },
        { label: "Walk", value: "6.2 km" },
        { label: "Streak", value: "5 days" },
      ],
    });
    return cache ?? [];
  }

  setFlash({
    spriteId: botId,
    kind: actionId,
    title: sprite.name,
    body: "Action noted.",
  });
  return cache ?? [];
}

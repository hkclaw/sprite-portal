/**
 * Core item spine (store / hopper only — not a shared field-kit):
 *   id, title, status, botId, updatedAt
 *
 * Each sprite keeps its own persona fields. Local JSON
 * (`/data/items.json`) is the seed. The store may overlay
 * in-session edits (complete / snooze / sprite actions) on top.
 */

export const ITEM_STATUSES = ["open", "done", "snoozed"];

export const STATUS_LABELS = {
  open: "未完成",
  done: "完成",
  snoozed: "延後",
};

/** @typedef {{ key: string, label: string, hint?: string }} PersonaField */

/** Per-sprite persona field labels (UI + mock JSON keys). */
export const FIELD_KITS = {
  jacob: [
    { key: "list", label: "TickTick", hint: "Work / Personal" },
    { key: "when", label: "何時", hint: "今日 / 過期" },
    { key: "priority", label: "優先" },
    { key: "tag", label: "標籤" },
  ],
  "english-edge": [
    { key: "nextClass", label: "下堂" },
    { key: "grammarFocus", label: "文法重點" },
    { key: "vocab", label: "詞彙" },
    { key: "script60s", label: "60 秒講稿" },
    { key: "studyReady", label: "温習就緒" },
  ],
  chaptermind: [
    { key: "shelf", label: "書架", hint: "在讀 / wishlist" },
    { key: "progress", label: "進度" },
    { key: "discuss", label: "想討論呢段" },
  ],
  homepilot: [
    { key: "category", label: "類別" },
    { key: "vendor", label: "供應商" },
    { key: "deadline", label: "限期" },
    { key: "urgent", label: "緊急" },
  ],
  jazz: [
    { key: "odo", label: "odo" },
    { key: "lastFill", label: "上次入油" },
    { key: "pricePerLiter", label: "$/L" },
    { key: "oilKmLeft", label: "換油剩餘 km" },
  ],
  vitalpilot: [
    { key: "garmin", label: "Garmin snapshot" },
    { key: "activity", label: "活動", hint: "Activity Monitor" },
    { key: "weighIn", label: "秤重" },
    { key: "soberStreak", label: "戒酒進度" },
  ],
};

const PERSONA_KEYS = [
  ...new Set(Object.values(FIELD_KITS).flatMap((fields) => fields.map((field) => field.key))),
];

/** @param {string} botId */
export function fieldKitFor(botId) {
  return FIELD_KITS[botId] ?? [];
}

/** @typedef {{
 *   id: string,
 *   title: string,
 *   status: "open" | "done" | "snoozed",
 *   botId: string,
 *   updatedAt: string,
 *   [key: string]: unknown
 * }} SpriteItem
 */

function copyPersonaValue(raw, key) {
  const value = raw[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map(String);
  return String(value);
}

/**
 * @param {Partial<SpriteItem> & Record<string, unknown>} raw
 * @returns {SpriteItem}
 */
export function asItem(raw = {}) {
  const status = ITEM_STATUSES.includes(raw.status) ? raw.status : "open";
  /** @type {SpriteItem} */
  const item = {
    id: typeof raw.id === "string" && raw.id ? raw.id : "",
    title: typeof raw.title === "string" ? raw.title : "",
    status,
    botId: typeof raw.botId === "string" ? raw.botId : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };

  const keys = new Set(PERSONA_KEYS);
  for (const field of fieldKitFor(item.botId)) keys.add(field.key);

  for (const key of keys) {
    const value = copyPersonaValue(raw, key);
    if (value !== undefined) item[key] = value;
  }

  return item;
}

export function isOpen(item) {
  return item.status === "open";
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.open;
}

export function priorityLabel(priority) {
  if (priority === "high") return "高";
  if (priority === "low") return "低";
  if (priority === "normal") return "中";
  return typeof priority === "string" ? priority : "";
}

/** Compact hopper line from persona fields. */
export function hopperHint(item) {
  switch (item.botId) {
    case "jacob":
      return [item.list, item.when, priorityLabel(item.priority), item.tag].filter(Boolean).join(" · ");
    case "english-edge":
      return [item.nextClass, item.studyReady === true ? "温習就緒" : ""].filter(Boolean).join(" · ");
    case "chaptermind":
      return [item.shelf, item.progress].filter(Boolean).join(" · ");
    case "homepilot":
      return [item.category, item.deadline, item.urgent === true ? "緊急" : ""].filter(Boolean).join(" · ");
    case "jazz":
      return [item.odo ? `odo ${item.odo}` : "", item.lastFill ? `上次入油 ${item.lastFill}` : ""]
        .filter(Boolean)
        .join(" · ");
    case "vitalpilot":
      return [item.activity, item.soberStreak ? `戒酒進度 ${item.soberStreak}` : ""].filter(Boolean).join(" · ");
    default:
      return "";
  }
}

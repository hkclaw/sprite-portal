/**
 * Core item spine (store / hopper only — not a shared field-kit):
 *   id, title, status, botId, updatedAt
 *
 * Each sprite keeps its own persona fields. Local JSON
 * (`/data/items.json`) is the seed. The store merges a
 * localStorage overlay (`sprite-portal:items-overlay`) of
 * partial edits (complete / snooze / local adds) on top.
 * 「還原種子」 clears the overlay and reloads seeds.
 */

export const ITEM_STATUSES = ["open", "done", "snoozed"];

export const STATUS_LABELS = {
  open: "未完成",
  done: "完成",
  snoozed: "延後",
};

/** @typedef {{ key: string, label: string, hint?: string }} PersonaField */

/**
 * Persona fields exposed on the 「加事項」 form per sprite.
 * All optional; empty values are not written into the new item.
 * @typedef {{
 *   key: string,
 *   label: string,
 *   kind: "text" | "select" | "checkbox",
 *   options?: { value: string, label: string }[],
 *   hint?: string
 * }} AddFormField
 */

/** Per-sprite persona field labels (UI + mock JSON keys). */
export const FIELD_KITS = {
  jacob: [
    { key: "list", label: "TickTick", hint: "Work / Personal" },
    { key: "due", label: "到期" },
    { key: "priority", label: "優先" },
    { key: "when", label: "Today / Overdue" },
    { key: "tag", label: "tag" },
  ],
  "english-edge": [
    { key: "nextClass", label: "下一堂" },
    { key: "grammar", label: "grammar" },
    { key: "vocab", label: "vocab" },
    { key: "scriptStatus", label: "speaking script status" },
    { key: "prep", label: "prep" },
  ],
  chaptermind: [
    { key: "shelf", label: "書架", hint: "在讀 / wishlist" },
    { key: "progress", label: "進度" },
    { key: "discuss", label: "想討論呢段" },
  ],
  homepilot: [
    { key: "category", label: "類別" },
    { key: "deadline", label: "deadline" },
    { key: "urgent", label: "urgent" },
    { key: "vendor", label: "供應商" },
    { key: "houseStatus", label: "狀態" },
  ],
  jazz: [
    { key: "odo", label: "odo" },
    { key: "station", label: "站" },
    { key: "fuelGrade", label: "油號" },
    { key: "liters", label: "L" },
    { key: "pricePerLiter", label: "$/L" },
    { key: "oilCountdown", label: "換油 countdown" },
    { key: "lPer100", label: "L/100" },
  ],
  vitalpilot: [
    { key: "garmin", label: "Garmin snapshot" },
    { key: "activity", label: "活動" },
    { key: "weighIn", label: "秤重" },
    { key: "soberStreak", label: "戒酒 streak" },
  ],
};

const PERSONA_KEYS = [
  ...new Set(Object.values(FIELD_KITS).flatMap((fields) => fields.map((field) => field.key))),
];

/** @param {string} botId */
export function fieldKitFor(botId) {
  return FIELD_KITS[botId] ?? [];
}

/**
 * Persona-aware optional fields rendered after 標題／到期 on the add form.
 * Labels are Traditional Chinese. Select options use the same values the
 * seed JSON uses so empty saves merge cleanly.
 */
export const ADD_FORM_FIELDS = {
  jacob: [
    {
      key: "list",
      label: "清單",
      kind: "select",
      options: [
        { value: "Work", label: "Work" },
        { value: "Personal", label: "Personal" },
      ],
    },
    {
      key: "priority",
      label: "優先",
      kind: "select",
      options: [
        { value: "high", label: "高" },
        { value: "normal", label: "中" },
        { value: "low", label: "低" },
      ],
    },
    { key: "tag", label: "標籤", kind: "text" },
  ],
  "english-edge": [
    { key: "grammar", label: "文法", kind: "text" },
    { key: "vocab", label: "詞彙", kind: "text" },
    { key: "prep", label: "預習", kind: "text" },
  ],
  chaptermind: [
    {
      key: "shelf",
      label: "書架",
      kind: "select",
      options: [
        { value: "在讀", label: "在讀" },
        { value: "wishlist", label: "wishlist" },
      ],
    },
    { key: "progress", label: "進度", kind: "text" },
    { key: "discuss", label: "想討論", kind: "text" },
  ],
  homepilot: [
    { key: "category", label: "類別", kind: "text" },
    { key: "urgent", label: "緊急", kind: "checkbox" },
    { key: "vendor", label: "供應商", kind: "text" },
  ],
  jazz: [
    { key: "station", label: "油站", kind: "text" },
    { key: "fuelGrade", label: "油號", kind: "text" },
    { key: "liters", label: "公升", kind: "text" },
  ],
  vitalpilot: [
    { key: "activity", label: "活動", kind: "text" },
    { key: "weighIn", label: "秤重", kind: "text" },
    { key: "soberStreak", label: "戒酒連續日", kind: "text" },
  ],
};

/** @param {string} botId @returns {AddFormField[]} */
export function addFormFieldsFor(botId) {
  return ADD_FORM_FIELDS[botId] ?? [];
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
      return [item.list, item.when, item.due ? `到期 ${item.due}` : "", item.tag].filter(Boolean).join(" · ");
    case "english-edge":
      return [item.nextClass, item.prep, item.scriptStatus].filter(Boolean).join(" · ");
    case "chaptermind":
      return [item.shelf, item.progress].filter(Boolean).join(" · ");
    case "homepilot":
      return [item.category, item.deadline, item.urgent === true ? "urgent" : "", item.houseStatus]
        .filter(Boolean)
        .join(" · ");
    case "jazz":
      return [item.odo ? `odo ${item.odo}` : "", item.station, item.lPer100 ? `${item.lPer100} L/100` : ""]
        .filter(Boolean)
        .join(" · ");
    case "vitalpilot":
      return [item.activity, item.soberStreak ? `戒酒 streak ${item.soberStreak}` : ""].filter(Boolean).join(" · ");
    default:
      return "";
  }
}

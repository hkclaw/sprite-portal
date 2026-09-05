/**
 * Shared item schema
 *
 * {
 *   id: string,
 *   title: string,
 *   status: "open" | "done" | "snoozed",
 *   botId: string,
 *   due?: string,          // ISO-8601 date
 *   tags: string[],
 *   notes?: string,
 *   priority?: string,     // "low" | "normal" | "high"
 *   updatedAt: string      // ISO-8601 datetime
 * }
 *
 * Local JSON (`/data/items.json`) is the seed. The store may overlay
 * in-session edits (complete / snooze / sprite actions) on top.
 */

export const ITEM_STATUSES = ["open", "done", "snoozed"];

export const ITEM_FIELDS = [
  "id",
  "title",
  "status",
  "botId",
  "due",
  "tags",
  "notes",
  "priority",
  "updatedAt",
];

/** @typedef {{
 *   id: string,
 *   title: string,
 *   status: "open" | "done" | "snoozed",
 *   botId: string,
 *   due?: string,
 *   tags: string[],
 *   notes?: string,
 *   priority?: string,
 *   updatedAt: string
 * }} SpriteItem
 */

/**
 * @param {Partial<SpriteItem> & Record<string, unknown>} raw
 * @returns {SpriteItem}
 */
export function asItem(raw = {}) {
  const status = ITEM_STATUSES.includes(raw.status) ? raw.status : "open";
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : "",
    title: typeof raw.title === "string" ? raw.title : "",
    status,
    botId: typeof raw.botId === "string" ? raw.botId : "",
    due: typeof raw.due === "string" ? raw.due : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
    priority: typeof raw.priority === "string" ? raw.priority : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

export function isOpen(item) {
  return item.status === "open";
}

/**
 * Shared item schema (V1 stub)
 *
 * Every bot-handled unit of work should eventually look like:
 *
 * {
 *   title: string,      // short label for the work item
 *   status: string,     // e.g. "inbox" | "open" | "waiting" | "done"
 *   botId: string,      // sprite id that owns the item
 *   due: string | null, // ISO-8601 date, or null if undated
 *   tags: string[],     // freeform labels
 *   notes: string       // longer context the sprite left behind
 * }
 *
 * Local JSON (`/data/items.json`) is enough for this shell.
 * Later rounds can swap in SQLite without changing this shape.
 */

export const ITEM_STATUSES = ["inbox", "open", "waiting", "done"];

export const ITEM_FIELDS = ["title", "status", "botId", "due", "tags", "notes"];

/** @typedef {{
 *   title: string,
 *   status: string,
 *   botId: string,
 *   due: string | null,
 *   tags: string[],
 *   notes: string
 * }} SpriteItem
 */

/**
 * Normalize a raw record toward the shared stub.
 * Missing fields stay visible so the empty shell can still render.
 * @param {Partial<SpriteItem> & Record<string, unknown>} raw
 * @returns {SpriteItem}
 */
export function asItem(raw = {}) {
  return {
    title: typeof raw.title === "string" ? raw.title : "",
    status: typeof raw.status === "string" ? raw.status : "inbox",
    botId: typeof raw.botId === "string" ? raw.botId : "",
    due: typeof raw.due === "string" ? raw.due : null,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    notes: typeof raw.notes === "string" ? raw.notes : "",
  };
}

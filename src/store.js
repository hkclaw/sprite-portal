import { asItem } from "./schema.js";

const ITEMS_URL = "/data/items.json";

/** @type {import("./schema.js").SpriteItem[] | null} */
let cache = null;

export async function loadItems() {
  if (cache) return cache;
  try {
    const response = await fetch(ITEMS_URL);
    const raw = response.ok ? await response.json() : [];
    cache = Array.isArray(raw) ? raw.map(asItem) : [];
  } catch {
    cache = [];
  }
  return cache;
}

/** @param {string} botId */
export async function itemsForBot(botId) {
  const items = await loadItems();
  return items.filter((item) => item.botId === botId);
}

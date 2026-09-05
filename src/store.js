import { asItem, isOpen } from "./schema.js";

const ITEMS_URL = "/data/items.json";
/** Partial overlay: { [id]: { status, updatedAt, ...changed fields } } */
const OVERLAY_KEY = "sprite-portal:items-overlay";
/** Legacy full-dump key from earlier builds — ignored on load, cleared on restore. */
const LEGACY_KEY = "sprite-portal-items-v3";

/** @type {import("./schema.js").SpriteItem[] | null} */
let cache = null;

/**
 * Immutable copy of the seed items kept around so primary actions can
 * re-merge after an overlay write without re-fetching items.json.
 * Populated by `loadItems` / `restoreSeeds`; cleared whenever the
 * overlay is cleared so the next load refreshes both at once.
 * @type {import("./schema.js").SpriteItem[] | null}
 */
let seedSnapshot = null;

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
    seedSnapshot = seed;
    cache = mergeSeed(seed, readOverlay());
  } catch {
    const overlay = readOverlay();
    cache = Object.keys(overlay).length
      ? mergeSeed([], overlay)
      : [];
    seedSnapshot = [];
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
  seedSnapshot = null;
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
 * Exported so the edit-item form can apply the same mapping on update.
 * @param {string} botId
 * @param {string} due
 */
export function personaFieldsForDue(botId, due) {
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
 * Strip persona fields down to non-empty values.
 * Strings are trimmed; empty strings drop the key.
 * `true` boolean is kept; `false` drops the key so it doesn't
 * show up on seeded JSON later as a noisy `false`.
 * Booleans coming from a checkbox "true"/"on"/"1" are normalised to true.
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {Record<string, unknown>}
 */
function cleanPersonaFields(raw) {
  if (!raw || typeof raw !== "object") return {};
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "boolean") {
      if (value === true) out[key] = true;
      continue;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (trimmed === "true" || trimmed === "on" || trimmed === "1") {
        out[key] = true;
        continue;
      }
      if (trimmed === "false" || trimmed === "off" || trimmed === "0") continue;
      out[key] = trimmed;
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length) out[key] = value;
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Patch overlay[id] with the given partial fields. null values are KEPT in
 * the overlay (not deleted) so the seed item's persona keys are explicitly
 * cleared on next mergeSeed (asItem ignores null, removing the field from
 * the result). Caller decides which keys to send.
 * @param {string} id
 * @param {Record<string, unknown>} patch
 * @returns {Record<string, unknown> | null}
 */
function writeOverlayForUpdate(id, patch) {
  if (!id || !patch) return null;
  try {
    const overlay = readOverlay();
    const prev = overlay[id] ?? {};
    const next = { ...prev, ...patch, updatedAt: nowIso() };
    overlay[id] = next;
    localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay));
    return next;
  } catch {
    return null;
  }
}

/**
 * Patch a single item in-place: title + persona fields. Field-level nulls
 * clear that key from the overlay (so it no longer surfaces on merge) and
 * from the cache entry (so the rendered row stops showing it). Seed items
 * survive restore-seeds; only their overlay partials are cleared.
 * @param {string} id
 * @param {Record<string, unknown>} patch
 * @returns {import("./schema.js").SpriteItem | null}
 */
export function updateLocalItem(id, patch) {
  if (!id) return null;
  const items = cache ?? [];
  const existing = items.find((item) => item.id === id);
  if (!existing) return null;

  const stored = writeOverlayForUpdate(id, patch);
  if (!stored) return null;

  /** @type {Record<string, unknown>} */
  const next = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  next.updatedAt = stored.updatedAt;
  const finalItem = asItem(next);
  cache = items.map((item) => (item.id === id ? finalItem : item));

  setFlash({
    spriteId: existing.botId,
    kind: "edit",
    title: "已更新",
    body: `「${finalItem.title}」已更新。`,
  });
  return finalItem;
}

/**
 * Delete a local-only item entirely from overlay + cache. Local items live
 * only in the overlay, so dropping the id removes them from both the next
 * load and the current render. Seed items are refused — they survive in
 * items.json and should be hidden, not deleted.
 * @param {string} id
 * @returns {boolean}
 */
export function removeLocalItem(id) {
  if (!id || !id.startsWith("local-")) return false;
  const items = cache ?? [];
  const existing = items.find((item) => item.id === id);
  if (!existing) return false;

  try {
    const overlay = readOverlay();
    delete overlay[id];
    localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay));
  } catch {
    /* ignore */
  }
  cache = items.filter((item) => item.id !== id);

  setFlash({
    spriteId: existing.botId,
    kind: "delete",
    title: "已刪除",
    body: `「${existing.title}」已刪除。`,
  });
  return true;
}

/**
 * Public add: creates a local item for the given sprite and flashes the result.
 * Optional `persona` carries the persona-aware add-form fields; empty values
 * are dropped so saved items only carry what the user actually filled in.
 * @param {{ botId: string, title: string, due?: string, persona?: Record<string, unknown> }} payload
 * @returns {import("./schema.js").SpriteItem | null}
 */
export function addLocalItem({ botId, title, due, persona }) {
  const cleanTitle = typeof title === "string" ? title.trim() : "";
  if (!botId || !cleanTitle) return null;

  const dueStr = typeof due === "string" ? due : "";
  const duePersona = personaFieldsForDue(botId, dueStr);
  const userPersona = cleanPersonaFields(persona);
  const item = addItem({
    botId,
    title: cleanTitle,
    status: "open",
    ...duePersona,
    ...userPersona,
  });

  setFlash({
    spriteId: botId,
    kind: "add",
    title: "已加事項",
    body: `「${item.title}」已加到書枱。`,
  });

  return item;
}

/**
 * Re-merge the current localStorage overlay onto the original seed and
 * replace the module cache with the result. The seed snapshot is taken
 * on the first successful `loadItems` / `restoreSeeds`; if it is missing
 * (e.g. during early boot) we fall back to the live cache as a best
 * effort so the merge still produces a consistent view. Pure local
 * data — never touches the network.
 * @returns {import("./schema.js").SpriteItem[]}
 */
function syncCacheFromOverlay() {
  const seed = seedSnapshot ?? ((cache ?? []).slice());
  cache = mergeSeed(seed, readOverlay());
  return cache;
}

/**
 * Shared post-write helper for primary sprite actions (inbox / class /
 * progress / urgent / refuel / garmin). Re-merges the overlay onto the
 * seed snapshot so the cache is exactly `mergeSeed(seedSnapshot,
 * readOverlay())`, then runs the caller-supplied `buildFlash` against
 * that fresh cache. This is what makes the flash reflect post-write
 * state — the buildFlash callback receives the synced rows, so any
 * `progress` / `houseStatus` / `garmin` value the action just stamped
 * is read from the synced cache, not from a stale pre-write reference.
 *
 * @param {(synced: import("./schema.js").SpriteItem[]) => { spriteId: string, kind: string, title: string, body: string, stats?: { label: string, value: string }[] }} buildFlash
 * @returns {import("./schema.js").SpriteItem[]}
 */
function finishPrimaryAction(buildFlash) {
  const synced = syncCacheFromOverlay();
  if (typeof buildFlash === "function") {
    setFlash(buildFlash(synced));
  }
  return synced;
}

/**
 * Sprite-specific handlers that perform REAL overlay writes for each
 * primary action. After the write helpers (updateLocalItem /
 * addLocalItem / completeItem) return, the flash is set with an
 * action-specific summary so the toast reflects the POST-write state —
 * stale pre-write counts would mislead the user.
 *
 * Per-sprite notes:
 *   - Jacob (inbox): tag the oldest open Jacob card (already-sorted
 *     ascending by updatedAt) with 已整理/跟進, AND complete one
 *     high-priority open if any exists. The 高優先 glance chip drops
 *     and the hopper tag line visibly changes.
 *   - English Edge (class): bump the latest open class card's prep /
 *     scriptStatus. If no open class card exists, addLocalItem a new
 *     local-* class card so the glance strip has something to show.
 *   - ChapterMind (progress): bump the latest 在讀 open card's
 *     progress percentage and refresh discuss. If nothing 在讀,
 *     addLocalItem a wishlist card.
 *   - HomePilot (urgent): pick the most urgent candidate — already
 *     urgent items win; otherwise nearest deadline / first open.
 *     Stamp urgent:true + houseStatus 處理中.
 *   - Jazz (refuel): addLocalItem a local-* refuel log with full
 *     persona. NEVER touch the fixed jz-refuel-log id; that path is
 *     intentionally removed so the seed jazz rows on disk stay clean.
 *   - VitalPilot (garmin): update the latest open vitalpilot row (or
 *     a prior local-* snapshot) with ONLY garmin / activity / weighIn
 *     / soberStreak. No medical diagnoses or account secrets.
 */
export function runSpriteAction(sprite, actionId) {
  const botId = sprite.id;

  if (actionId === "inbox") {
    const items = cache ?? [];
    const open = items.filter((item) => item.botId === botId && isOpen(item));

    // Oldest open = lowest updatedAt. Tagging it makes the hopper row
    // visibly move (tag line) and the desk table row pick up the new
    // value. 已整理 for routine cards, 跟進 if it's already high
    // priority so we don't double-tag a row we may also close below.
    const sortedByOldest = open
      .slice()
      .sort((a, b) => (a.updatedAt || "").localeCompare(b.updatedAt || ""));
    const oldest = sortedByOldest[0] ?? null;
    const oldestTitle = oldest ? oldest.title : null;
    const oldestFollowUp = oldest
      ? oldest.priority === "high"
        ? "跟進"
        : "已整理"
      : null;
    if (oldest && oldestFollowUp) {
      updateLocalItem(oldest.id, { tag: oldestFollowUp });
    }

    // One high-priority open, if any, gets completed so the 高優先
    // glance chip drops. patchItem merges so the tag survives if the
    // row is also the oldest (single-id path).
    const highPriority = open.find((item) => item.priority === "high");
    const highPriorityTitle = highPriority ? highPriority.title : null;
    if (highPriority) {
      completeItem(highPriority.id);
    }

    // Re-merge the overlay onto the seed snapshot, then build the
    // flash from the synced cache so the post-write counts (and the
    // surviving oldest / highPriority titles, re-read in case they
    // drifted) drive the toast — not the stale pre-write refs.
    return finishPrimaryAction((synced) => {
      const liveOpen = synced.filter(
        (item) => item.botId === botId && isOpen(item),
      );
      const work = liveOpen.filter((item) => item.list === "Work").length;
      const personal = liveOpen.filter((item) => item.list === "Personal").length;
      const today = liveOpen.filter((item) => item.when === "Today").length;
      const overdue = liveOpen.filter((item) => item.when === "Overdue").length;
      const high = liveOpen.filter((item) => item.priority === "high").length;
      const earliest = liveOpen
        .filter((item) => typeof item.due === "string" && item.due)
        .map((item) => item.due)
        .sort()[0];

      /** @type {string[]} */
      const parts = [
        `TickTick Work ${work} / Personal ${personal}`,
        `Today ${today}`,
        `Overdue ${overdue}`,
        `優先高 ${high} 張`,
      ];
      if (oldestFollowUp && oldestTitle) parts.push(`已標「${oldestFollowUp}」· ${oldestTitle}`);
      if (highPriorityTitle) parts.push(`已勾走「${highPriorityTitle}」`);
      parts.push(`最早到期 ${earliest || "—"}`);

      return {
        spriteId: botId,
        kind: "inbox",
        title: "執漏收件箱",
        body: `${parts.join(" · ")}。`,
      };
    });
  }

  if (actionId === "class") {
    const items = cache ?? [];
    const open = items.filter((item) => item.botId === botId && isOpen(item));
    const sortedByNewest = open
      .slice()
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    let latest = sortedByNewest[0] ?? null;

    if (latest) {
      // Bump prep / scriptStatus on the latest open class card so the
      // glanceChips english-edge projection (nextClass, grammar, vocab,
      // prep) visibly moves. updatedAt stamps from writeOverlayForUpdate
      // so this row stays the newestOpen.
      updateLocalItem(latest.id, {
        prep: "已備",
        scriptStatus: "就緒",
      });
    } else {
      // No open class card: addLocalItem a local-* fallback so the
      // glance strip has fresh persona to project. No fixed id, no
      // seed-row mutation.
      const created = addLocalItem({
        botId,
        title: "新增課堂卡",
        persona: {
          nextClass: todayYmd(),
          grammar: "待填",
          vocab: "待填",
          prep: "未備",
          scriptStatus: "未寫",
        },
      });
      latest = created;
    }

    // Sync overlay → cache, then build flash from the synced row so the
    // bumped prep / scriptStatus (and the freshly-created fallback) are
    // the values the toast surfaces.
    return finishPrimaryAction((synced) => {
      const liveLatest = latest
        ? (synced.find((item) => item.id === latest.id) ?? latest)
        : null;
      if (!liveLatest) {
        return {
          spriteId: botId,
          kind: "class",
          title: "今日課堂",
          body: "冇未完成嘅課堂卡。",
        };
      }
      return {
        spriteId: botId,
        kind: "class",
        title: "今日課堂",
        body: `下一堂 ${liveLatest.nextClass || "—"}。grammar：${liveLatest.grammar || "—"}。vocab：${liveLatest.vocab || "—"}。speaking script status：${liveLatest.scriptStatus || "—"}。prep：${liveLatest.prep || "—"}。`,
      };
    });
  }

  if (actionId === "progress") {
    const items = cache ?? [];
    const reading = items.filter(
      (item) => item.botId === botId && item.shelf === "在讀" && isOpen(item),
    );
    const sortedByNewest = reading
      .slice()
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    let focused = sortedByNewest[0] ?? null;

    if (focused) {
      // Bump the percentage in the progress string by +5 if it carries
      // one; otherwise append a hint. Refresh discuss with a small
      // marker so the chaptermind glance chip (進度 / 想討論呢段)
      // visibly moves after the write. The replacement string uses only
      // `${sp}` — the captured `\s*%` group already carries the percent
      // sign, so re-emitting `%` here would double-stamp "62%" as
      // "67%%". After the write the focused row is re-read from the
      // synced cache below so the flash shows the bumped progress.
      const cur = String(focused.progress || "");
      const match = cur.match(/(\d+)(\s*%)/);
      const newProgress = match
        ? cur.replace(
            /(\d+)(\s*%)/,
            (_m, n, sp) => `${Math.min(100, parseInt(n, 10) + 5)}${sp}`,
          )
        : `${cur}${cur ? " · " : ""}剛加咗 5%`;
      const oldDiscuss = String(focused.discuss || "").trim();
      const newDiscuss = oldDiscuss ? `${oldDiscuss} · 重新整理過。` : "剛整理過。";
      updateLocalItem(focused.id, {
        progress: newProgress,
        discuss: newDiscuss,
      });
    } else {
      // No 在讀 open card: addLocalItem a wishlist row so the
      // glanceChips chaptermind projection (書架 / 進度 / 討論 /
      // wishlist count) has fresh persona to show.
      const created = addLocalItem({
        botId,
        title: "新增 wishlist 書",
        persona: {
          shelf: "wishlist",
          progress: "剛加入",
          discuss: "待揀書",
        },
      });
      focused = created;
    }

    // Re-merge overlay, then build the flash from the synced row so
    // the bumped progress / discuss (and the freshly-created wishlist
    // fallback) are what the toast surfaces — not the pre-write ref.
    return finishPrimaryAction((synced) => {
      const liveFocused = focused
        ? (synced.find((item) => item.id === focused.id) ?? focused)
        : null;
      if (!liveFocused) {
        return {
          spriteId: botId,
          kind: "progress",
          title: "閱讀進度",
          body: "書架暫時空住。",
        };
      }
      const liveBooks = synced.filter((item) => item.botId === botId);
      const liveReading = liveBooks.filter((item) => item.shelf === "在讀");
      const liveWishlist = liveBooks.filter((item) => item.shelf === "wishlist");
      return {
        spriteId: botId,
        kind: "progress",
        title: "閱讀進度",
        body: `在讀「${liveFocused.title}」· ${liveFocused.progress || "—"}。想討論呢段：${liveFocused.discuss || "—"}`,
        stats: [
          { label: "在讀", value: String(liveReading.length) },
          { label: "wishlist", value: String(liveWishlist.length) },
          { label: "進度", value: liveFocused.progress ? String(liveFocused.progress) : "—" },
        ],
      };
    });
  }

  if (actionId === "urgent") {
    const items = cache ?? [];
    const open = items.filter((item) => item.botId === botId && isOpen(item));

    // Most urgent candidate: already-urgent wins (it's the one already
    // flagged). Otherwise nearest deadline / first open so something
    // gets marked urgent when the user hasn't flagged anything yet.
    let candidate = open.find((item) => item.urgent === true) ?? null;
    if (!candidate) {
      candidate =
        open
          .filter((item) => typeof item.deadline === "string" && item.deadline)
          .slice()
          .sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""))[0] ??
        null;
    }
    if (!candidate) {
      candidate = open[0] ?? null;
    }

    if (!candidate) {
      setFlash({
        spriteId: botId,
        kind: "urgent",
        title: "家居緊急",
        body: "冇未完成嘅家務。",
      });
      return cache ?? [];
    }

    // Stash the title before updateLocalItem mutates cache (we keep the
    // reference but the patch re-creates the row, so read fields now).
    const candidateTitle = candidate.title;
    const candidateCategory = candidate.category;
    const candidateVendor = candidate.vendor;
    const candidateDeadline = candidate.deadline;

    updateLocalItem(candidate.id, {
      urgent: true,
      houseStatus: "處理中",
    });

    // Re-merge overlay, then build the flash from the synced state so
    // the urgent count + nearest deadline reflect the row we just
    // stamped (post-write houseStatus "處理中" is rendered by the
    // homepilot glanceChips and stays in sync via the same merged view).
    return finishPrimaryAction((synced) => {
      const liveOpen = synced.filter(
        (item) => item.botId === botId && isOpen(item),
      );
      const urgentCount = liveOpen.filter((item) => item.urgent === true).length;
      const nearest = liveOpen
        .filter((item) => typeof item.deadline === "string" && item.deadline)
        .slice()
        .sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""))[0];
      return {
        spriteId: botId,
        kind: "urgent",
        title: "家居緊急",
        body: `已標緊急：${candidateTitle}（${candidateCategory || "類別 —"} · 供應商 ${candidateVendor || "—"} · deadline ${candidateDeadline || "—"} · 狀態 處理中）。現共 ${urgentCount} 張緊急，最近 deadline ${nearest?.deadline || "—"}。`,
      };
    });
  }

  if (actionId === "refuel") {
    // CRITICAL: use addLocalItem (no fixed id) so the row gets a
    // local-* id and lives entirely in the overlay. The fixed
    // jz-refuel-log id path was removed — using it would shadow the
    // seed jz-* rows on disk and corrupt the desk table on refresh.
    const created = addLocalItem({
      botId,
      title: "入油紀錄",
      persona: {
        odo: "43,020 km",
        station: "加德士黃竹坑",
        fuelGrade: "98",
        liters: "36.4",
        pricePerLiter: "16.9",
        oilCountdown: "980 km",
        lPer100: "7.1",
      },
    });

    // glanceChips jazz uses newestOpen ?? newestAny, so even if the new
    // row was created done, the just-stamped updatedAt would still pick
    // it. We default to open here for visibility, but the projection
    // handles both. Re-find the created row in the synced cache so the
    // flash reflects the exact merged view the glance strip will show.
    return finishPrimaryAction((synced) => {
      const liveCreated = created
        ? (synced.find((item) => item.id === created.id) ?? created)
        : null;
      if (!liveCreated) {
        return {
          spriteId: botId,
          kind: "refuel",
          title: "入油",
          body: "入油加唔到。",
        };
      }
      return {
        spriteId: botId,
        kind: "refuel",
        title: "入油",
        body: `入油已記。站 ${liveCreated.station || "—"} · 油號 ${liveCreated.fuelGrade || "—"} · ${liveCreated.liters || "—"} L · $${liveCreated.pricePerLiter || "—"}/L。odo ${liveCreated.odo || "—"} · 換油 countdown ${liveCreated.oilCountdown || "—"} · ${liveCreated.lPer100 || "—"} L/100。`,
      };
    });
  }

  if (actionId === "garmin") {
    const items = cache ?? [];
    const open = items.filter((item) => item.botId === botId && isOpen(item));
    const sortedOpen = open
      .slice()
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    // Fall back to a prior local-* snapshot (open OR done) so the user
    // keeps building on the same row across clicks instead of littering
    // the overlay with one-off snapshots.
    const localPrior = items.find(
      (item) => typeof item.id === "string" && item.id.startsWith("local-"),
    );
    let target = sortedOpen[0] ?? localPrior ?? null;

    // ONLY the four VitalPilot persona fields the spec sanctions —
    // never invent medical diagnoses, conditions, or stash account
    // secrets. Stays Traditional Chinese / Cantonese in tone.
    const nextValues = {
      garmin: "9,124 步 · 48 分鐘",
      activity: "Activity Monitor · 港灣圈再一圈",
      weighIn: "72.3 kg",
      soberStreak: "13 日",
    };

    if (target) {
      updateLocalItem(target.id, nextValues);
    } else {
      // No open row, no local prior — create a fresh local-* snapshot.
      const created = addLocalItem({
        botId,
        title: "Garmin snapshot",
        persona: nextValues,
      });
      target = created;
    }

    // Re-merge overlay, then build the flash from the synced target so
    // the four VitalPilot stats reflect the freshly-stamped values
    // rather than the pre-write refs.
    return finishPrimaryAction((synced) => {
      const liveTarget = target
        ? (synced.find((item) => item.id === target.id) ?? target)
        : null;
      if (!liveTarget) {
        return {
          spriteId: botId,
          kind: "garmin",
          title: "Garmin snapshot",
          body: "只記活動同習慣——唔寫診斷，亦唔存登入資料。",
        };
      }
      return {
        spriteId: botId,
        kind: "garmin",
        title: "Garmin snapshot",
        body: "只記活動同習慣——唔寫診斷，亦唔存登入資料。",
        stats: [
          { label: "Garmin snapshot", value: String(liveTarget.garmin || "—") },
          { label: "活動", value: String(liveTarget.activity || "—") },
          { label: "秤重", value: String(liveTarget.weighIn || "—") },
          { label: "戒酒 streak", value: String(liveTarget.soberStreak || "—") },
        ],
      };
    });
  }

  setFlash({
    spriteId: botId,
    kind: actionId,
    title: sprite.name,
    body: "已記下呢個動作。",
  });
  return cache ?? [];
}

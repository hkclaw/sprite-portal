import { startRouter } from "./router.js";
import { addFormFieldsFor } from "./schema.js";
import { findSprite } from "./sprites.js";
import {
  addLocalItem,
  completeFirstOpen,
  completeItem,
  getFlash,
  loadItems,
  personaFieldsForDue,
  removeLocalItem,
  restoreSeeds,
  runSpriteAction,
  snoozeFirstOpen,
  snoozeItem,
  updateLocalItem,
} from "./store.js";
import { renderDashboard, renderNotFound, renderSprite, personaAddFieldsHtml } from "./views.js";
import "./styles.css";

/**
 * UI-only desk filter, persisted across paint() so chip clicks feel sticky.
 * Default: 未完成 (open), so first paint of a sprite room shows the working
 * subset. Seed / overlay / cache are untouched.
 * @type {"open"|"all"|"done"|"snoozed"}
 */
let activeDeskFilter = "open";

const VALID_HOPPER_FILTERS = ["open", "today", "overdue", "all"];
const HOPPER_FILTER_STORAGE_KEY = "sprite-portal:hopper-filter";

/**
 * Read the sticky hopper filter from sessionStorage. Falls back to "open"
 * when the storage slot is missing, empty, or carries an unknown value —
 * anything stale in devtools shouldn't crash the dashboard.
 * @returns {"open"|"today"|"overdue"|"all"}
 */
function readHopperFilter() {
  try {
    const raw = sessionStorage.getItem(HOPPER_FILTER_STORAGE_KEY);
    if (raw && VALID_HOPPER_FILTERS.includes(raw)) {
      return /** @type {"open"|"today"|"overdue"|"all"} */ (raw);
    }
  } catch {
    /* sessionStorage may throw in privacy modes; default is fine */
  }
  return "open";
}

/**
 * Persist the hopper filter so reload / re-mount keeps the user's choice.
 * Wrapped in try/catch so quota errors or locked-down storage don't break
 * the click path.
 * @param {"open"|"today"|"overdue"|"all"} value
 */
function writeHopperFilter(value) {
  try {
    sessionStorage.setItem(HOPPER_FILTER_STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

/**
 * UI-only Dashboard hopper filter. Mirrors the desk-filter pattern: a module
 * var keeps the active slice across paint() while sessionStorage makes it
 * sticky for the tab session. Defaults to "open" so the first paint shows
 * the working subset, same vibe as the desk filter.
 * @type {"open"|"today"|"overdue"|"all"}
 */
let activeHopperFilter = readHopperFilter();

/** When set, renderSprite opens the edit form for this item inline. */
let editingItemId = null;

const VALID_DESK_FILTERS = ["open", "all", "done", "snoozed"];

const app = document.querySelector("#app");

function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast || !message) return;
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add("is-on");
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.classList.remove("is-on");
    toast.hidden = true;
  }, 2400);
}

/**
 * Pull persona-aware optional fields out of a submitted add form.
 * Uses `addFormFieldsFor(botId)` to know which keys + kinds belong to
 * the selected sprite, then reads `persona.<key>` from FormData.
 * Empty strings are dropped here so the store stays clean even if
 * the schema helper isn't reached.
 * @param {FormData} formData
 * @param {string} botId
 * @returns {Record<string, unknown>}
 */
function collectPersonaFromForm(formData, botId) {
  const fields = addFormFieldsFor(botId);
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const field of fields) {
    const name = `persona.${field.key}`;
    if (field.kind === "checkbox") {
      // FormData only includes a checkbox when it's ticked.
      if (formData.has(name)) out[field.key] = true;
      continue;
    }
    const raw = formData.get(name);
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (trimmed) out[field.key] = trimmed;
  }
  return out;
}

async function paint(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";

  // Drop the in-flight edit when navigating off a sprite room. Filter is
  // a UI preference so it survives across navigation.
  if (!path.startsWith("/sprites/")) {
    editingItemId = null;
  }

  if (path === "/") {
    const items = await loadItems();
    app.innerHTML = renderDashboard(items, { hopperFilter: activeHopperFilter });
    return;
  }

  const match = path.match(/^\/sprites\/([^/]+)$/);
  if (match) {
    const sprite = findSprite(match[1]);
    const allItems = await loadItems();
    if (!sprite) {
      app.innerHTML = renderNotFound(allItems);
      return;
    }
    const items = allItems.filter((item) => item.botId === sprite.id);
    const flash = getFlash();
    app.innerHTML = renderSprite(
      sprite,
      items,
      flash && flash.spriteId === sprite.id ? flash : null,
      allItems,
      { deskFilter: activeDeskFilter, editingId: editingItemId },
    );
    return;
  }

  const allItems = await loadItems();
  app.innerHTML = renderNotFound(allItems);
}

startRouter(paint);

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.tagName === "FORM" || button.tagName === "INPUT" || button.tagName === "SELECT" || button.tagName === "TEXTAREA") {
    return;
  }

  const action = button.getAttribute("data-action");
  if (action === "add-item") return;
  const itemId = button.getAttribute("data-item-id");
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const match = path.match(/^\/sprites\/([^/]+)$/);
  const sprite = match ? findSprite(match[1]) : null;

  if (action === "restore-seeds") {
    if (!window.confirm("確定還原種子？會清除本機完成／延後覆寫同自己加嘅事項。")) return;
    await restoreSeeds();
    await paint(path);
    showToast("已還原種子");
    return;
  }

  if (action === "desk-filter") {
    const filter = button.getAttribute("data-filter");
    if (filter && VALID_DESK_FILTERS.includes(filter)) {
      activeDeskFilter = /** @type {"open"|"all"|"done"|"snoozed"} */ (filter);
    }
    await paint(path);
    return;
  }

  if (action === "hopper-filter") {
    const filter = button.getAttribute("data-filter");
    if (filter && VALID_HOPPER_FILTERS.includes(filter)) {
      activeHopperFilter = /** @type {"open"|"today"|"overdue"|"all"} */ (filter);
      writeHopperFilter(activeHopperFilter);
    }
    await paint(path);
    return;
  }

  if (action === "edit-item" && itemId) {
    editingItemId = itemId;
    await paint(path);
    return;
  }

  if (action === "cancel-edit") {
    editingItemId = null;
    await paint(path);
    return;
  }

  if (action === "delete-item" && itemId) {
    if (!itemId.startsWith("local-")) {
      showToast("種子項目唔可以刪除");
      return;
    }
    if (!window.confirm("確定刪除呢張本地事項？")) return;
    if (editingItemId === itemId) editingItemId = null;
    removeLocalItem(itemId);
    await paint(path);
    showToast("已刪除");
    return;
  }

  if (action === "complete" && itemId) {
    if (editingItemId === itemId) editingItemId = null;
    completeItem(itemId);
    await paint(path);
    showToast("完成");
    return;
  }

  if (action === "snooze" && itemId) {
    if (editingItemId === itemId) editingItemId = null;
    snoozeItem(itemId);
    await paint(path);
    showToast("延後");
    return;
  }

  if (!sprite) return;

  if (action === "complete-first") {
    completeFirstOpen(sprite.id);
    await paint(path);
    showToast("完成");
    return;
  }

  if (action === "snooze-first") {
    snoozeFirstOpen(sprite.id);
    await paint(path);
    showToast("延後");
    return;
  }

  if (action === "sprite") {
    const spriteAction = button.getAttribute("data-sprite-action");
    runSpriteAction(sprite, spriteAction);
    await paint(path);
    showToast(button.textContent.trim());
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const formAction = form.getAttribute("data-action");
  if (formAction !== "add-item" && formAction !== "save-edit") return;

  event.preventDefault();
  const path = location.pathname.replace(/\/+$/, "") || "/";

  if (formAction === "add-item") {
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const due = String(formData.get("due") || "").trim();
    const botId = String(formData.get("botId") || "").trim();

    if (!title) {
      showToast("標題唔可以空白");
      return;
    }
    if (!botId) {
      showToast("揀個精靈先");
      return;
    }

    const persona = collectPersonaFromForm(formData, botId);
    const created = addLocalItem({ botId, title, due, persona });
    if (!created) {
      showToast("加唔到，試多次");
      return;
    }

    await paint(path);
    showToast("已加事項");
    return;
  }

  if (formAction === "save-edit") {
    const itemId = String(form.getAttribute("data-item-id") || "");
    if (!itemId) return;

    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const due = String(formData.get("due") || "").trim();

    if (!title) {
      showToast("標題唔可以空白");
      return;
    }

    const items = await loadItems();
    const item = items.find((entry) => entry.id === itemId);
    if (!item) {
      editingItemId = null;
      showToast("事項唔存在");
      await paint(path);
      return;
    }

    const persona = collectPersonaFromForm(formData, item.botId);
    const duePersona = personaFieldsForDue(item.botId, due);

    /**
     * When the user clears 到期 on the edit form, personaFieldsForDue
     * returns `{}` and the old mapped value would silently stick around
     * in the overlay. Null out the same key personaFieldsForDue would
     * have written, so the rendered row stops surfacing a stale date.
     * Mirrors personaFieldsForDue's bot-specific mapping.
     */
    /** @type {Record<string, unknown>} */
    const dueClears = {};
    if (!due) {
      if (item.botId === "jacob") dueClears.due = null;
      else if (item.botId === "english-edge") dueClears.nextClass = null;
      else if (item.botId === "homepilot") dueClears.deadline = null;
    }

    /**
     * Edit patch = title + due-mapped persona + persona fields the user
     * actually touched. Anything in addFormFieldsFor that isn't present
     * here means the user cleared it (or left it untouched, which still
     * overrides via the rendered prefill) — set null so asItem drops the
     * key from both overlay and cache.
     * @type {Record<string, unknown>}
     */
    const finalPatch = { title, ...duePersona, ...dueClears, ...persona };
    for (const field of addFormFieldsFor(item.botId)) {
      if (!(field.key in finalPatch)) {
        finalPatch[field.key] = null;
      }
    }

    updateLocalItem(itemId, finalPatch);
    editingItemId = null;
    await paint(path);
    showToast("已更新");
  }
});

// When the Dashboard 精靈 select changes, swap the persona fields in place.
document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (target.name !== "botId") return;
  const form = target.form;
  const host = form?.querySelector("[data-persona-host]");
  if (!host) return;
  host.dataset.bot = target.value;
  host.innerHTML = personaAddFieldsHtml(target.value);
});

// Keyboard activation for the clickable dashboard stats. They're <div>s with
// role="button" + tabindex="0", so Enter/Space need to map to a synthetic
// click — the existing click handler does the rest. Stays focused on stat
// elements only; chips are already <button>s and handle keys natively.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains("stat") || !target.classList.contains("is-clickable")) return;
  if (!target.hasAttribute("data-action")) return;
  event.preventDefault();
  target.click();
});

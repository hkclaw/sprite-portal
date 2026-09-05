import { startRouter } from "./router.js";
import { addFormFieldsFor } from "./schema.js";
import { findSprite } from "./sprites.js";
import {
  addLocalItem,
  completeFirstOpen,
  completeItem,
  getFlash,
  loadItems,
  restoreSeeds,
  runSpriteAction,
  snoozeFirstOpen,
  snoozeItem,
} from "./store.js";
import { renderDashboard, renderNotFound, renderSprite, personaAddFieldsHtml } from "./views.js";
import "./styles.css";

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

  if (path === "/") {
    const items = await loadItems();
    app.innerHTML = renderDashboard(items);
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

  if (action === "complete" && itemId) {
    completeItem(itemId);
    await paint(path);
    showToast("完成");
    return;
  }

  if (action === "snooze" && itemId) {
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
  if (form.getAttribute("data-action") !== "add-item") return;

  event.preventDefault();

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

  const path = location.pathname.replace(/\/+$/, "") || "/";
  await paint(path);
  showToast("已加事項");
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

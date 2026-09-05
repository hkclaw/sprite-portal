import { startRouter } from "./router.js";
import { findSprite } from "./sprites.js";
import {
  completeFirstOpen,
  completeItem,
  getFlash,
  itemsForBot,
  loadItems,
  runSpriteAction,
  snoozeFirstOpen,
  snoozeItem,
} from "./store.js";
import { renderDashboard, renderNotFound, renderSprite } from "./views.js";
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
    if (!sprite) {
      app.innerHTML = renderNotFound();
      return;
    }
    const items = await itemsForBot(sprite.id);
    const flash = getFlash();
    app.innerHTML = renderSprite(sprite, items, flash && flash.spriteId === sprite.id ? flash : null);
    return;
  }

  app.innerHTML = renderNotFound();
}

startRouter(paint);

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.getAttribute("data-action");
  const itemId = button.getAttribute("data-item-id");
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const match = path.match(/^\/sprites\/([^/]+)$/);
  const sprite = match ? findSprite(match[1]) : null;

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

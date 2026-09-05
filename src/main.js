import { startRouter } from "./router.js";
import { findSprite } from "./sprites.js";
import { itemsForBot, loadItems } from "./store.js";
import { renderDashboard, renderNotFound, renderSprite } from "./views.js";
import "./styles.css";

const app = document.querySelector("#app");

startRouter(async (pathname) => {
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
    app.innerHTML = renderSprite(sprite, items);
    return;
  }

  app.innerHTML = renderNotFound();
});

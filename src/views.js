import { ITEM_FIELDS } from "./schema.js";
import { SPRITES } from "./sprites.js";

function spriteFigure(sprite, size = "md") {
  return `
    <div class="sprite sprite-${sprite.accent} sprite-${size}" aria-hidden="true">
      <div class="sprite-glow"></div>
      <div class="sprite-body">
        <div class="sprite-hat"></div>
        <div class="sprite-face">
          <span class="eye left"></span>
          <span class="eye right"></span>
          <span class="blush left"></span>
          <span class="blush right"></span>
          <span class="mouth"></span>
        </div>
        <div class="sprite-prop"></div>
      </div>
      <div class="sprite-shadow"></div>
    </div>
  `;
}

function shell(content, activePath) {
  const nav = SPRITES.map((sprite) => {
    const current = activePath === sprite.path ? "is-current" : "";
    return `
      <a class="nav-sprite ${current}" href="${sprite.path}" data-link title="${sprite.name}">
        ${spriteFigure(sprite, "xs")}
        <span>${sprite.name}</span>
      </a>
    `;
  }).join("");

  return `
    <div class="sky" aria-hidden="true">
      <i class="orb orb-a"></i>
      <i class="orb orb-b"></i>
      <i class="orb orb-c"></i>
      <i class="twinkle t1"></i>
      <i class="twinkle t2"></i>
      <i class="twinkle t3"></i>
      <i class="twinkle t4"></i>
    </div>
    <header class="mast">
      <a class="brand" href="/" data-link>
        <span class="portal-ring" aria-hidden="true"></span>
        <span>
          <strong>Sprite Portal</strong>
          <small>Jacob’s local bot nursery</small>
        </span>
      </a>
      <nav class="sprite-rail" aria-label="Sprites">${nav}</nav>
    </header>
    <main class="stage">${content}</main>
  `;
}

export function renderDashboard(items) {
  const cards = SPRITES.map(
    (sprite, index) => `
      <a class="sprite-card accent-${sprite.accent}" href="${sprite.path}" data-link style="--delay:${index * 70}ms">
        ${spriteFigure(sprite, "md")}
        <div class="card-copy">
          <h2>${sprite.name}</h2>
          <p>${sprite.tagline}</p>
          <span class="chip">0 items</span>
        </div>
      </a>
    `,
  ).join("");

  const emptyTodos = `
    <section class="todo-dock empty-dock">
      <div class="dock-sprite" aria-hidden="true">
        <div class="sleepy-tray">
          <span class="zzz z1">z</span>
          <span class="zzz z2">z</span>
          <span class="zzz z3">z</span>
        </div>
      </div>
      <div>
        <h2>Todo hopper</h2>
        <p>Nothing in the tray yet. When a sprite hands you work, items land here with <code>title</code>, <code>status</code>, <code>botId</code>, <code>due</code>, <code>tags</code>, and <code>notes</code>.</p>
        <p class="muted">${items.length} stored item${items.length === 1 ? "" : "s"} in local JSON.</p>
      </div>
    </section>
  `;

  return shell(
    `
      <section class="hero">
        <p class="eyebrow">Good stretch, crew</p>
        <h1>Your sprites are awake and wiggling.</h1>
        <p class="lede">A playful local HQ for the Grok bots that help Jacob. Open a sprite to peek at its desk — the desks are still empty, but the lights are on.</p>
      </section>
      ${emptyTodos}
      <section>
        <div class="section-head">
          <h2>Sprite overview</h2>
          <p>Six little assistants. Cards are placeholders; personas get louder later.</p>
        </div>
        <div class="sprite-grid">${cards}</div>
      </section>
    `,
    "/",
  );
}

export function renderSprite(sprite, items) {
  const empty = items.length === 0;
  const list = empty
    ? `
      <div class="empty-desk">
        <div class="empty-desk-art" aria-hidden="true">
          ${spriteFigure(sprite, "sm")}
          <div class="blank-page"></div>
        </div>
        <h3>Desk is clear</h3>
        <p>No items for <strong>${sprite.name}</strong> yet. Future work will use the shared stub: <code>{ title, status, botId, due, tags, notes }</code>.</p>
      </div>
    `
    : `<ul class="item-list">${items
        .map(
          (item) => `
        <li class="item-card">
          <h3>${escapeHtml(item.title || "Untitled")}</h3>
          <p class="muted">${escapeHtml(item.status)} · ${item.due || "no due date"}</p>
          <p>${escapeHtml(item.notes)}</p>
        </li>
      `,
        )
        .join("")}</ul>`;

  return shell(
    `
      <a class="back" href="/" data-link>← Back to the nursery</a>
      <section class="sprite-hero accent-${sprite.accent}">
        ${spriteFigure(sprite, "lg")}
        <div>
          <p class="eyebrow">${sprite.name}</p>
          <h1>${sprite.tagline}</h1>
          <p class="lede">${sprite.vibe}</p>
        </div>
      </section>
      <div class="sprite-panels">
        <section class="panel">
          <h2>Items</h2>
          ${list}
        </section>
        <aside class="panel schema-peek">
          <h2>Item field kit</h2>
          <p>Shared schema stub for every sprite:</p>
          <pre>{
  title, status, botId,
  due, tags, notes
}</pre>
          <ul class="field-list">
            ${ITEM_FIELDS.map((field) => `<li><code>${field}</code></li>`).join("")}
          </ul>
        </aside>
      </div>
    `,
    sprite.path,
  );
}

export function renderNotFound() {
  return shell(
    `
      <section class="hero">
        <h1>That sprite wandered off.</h1>
        <p class="lede">No portal door here. Head back to the nursery.</p>
        <a class="back" href="/" data-link>← Dashboard</a>
      </section>
    `,
    "",
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

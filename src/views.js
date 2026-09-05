import { ITEM_FIELDS } from "./schema.js";
import { SHARED_ACTIONS, SPRITES } from "./sprites.js";
import { openCountFor, openItems } from "./store.js";

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
    <div class="toast" id="toast" hidden></div>
  `;
}

function statusLabel(status) {
  if (status === "done") return "done";
  if (status === "snoozed") return "snoozed";
  return "open";
}

function itemActions(item) {
  if (item.status !== "open") return "";
  return `
    <div class="item-actions">
      <button type="button" class="btn btn-complete" data-action="complete" data-item-id="${escapeAttr(item.id)}">完成</button>
      <button type="button" class="btn btn-snooze" data-action="snooze" data-item-id="${escapeAttr(item.id)}">延後</button>
    </div>
  `;
}

function itemCard(item, spriteName) {
  const due = item.due ? `due ${item.due}` : "no due date";
  const tags = (item.tags ?? []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  const notes = item.notes ? `<p>${escapeHtml(item.notes)}</p>` : "";
  const who = spriteName ? `<span class="item-who">${escapeHtml(spriteName)}</span>` : "";
  return `
    <li class="item-card status-${item.status} priority-${item.priority || "normal"}">
      <div class="item-top">
        <h3>${escapeHtml(item.title || "Untitled")}</h3>
        <span class="chip status-chip">${statusLabel(item.status)}</span>
      </div>
      <p class="muted">${who}${who ? " · " : ""}${escapeHtml(item.status)} · ${escapeHtml(due)}${item.priority ? ` · ${escapeHtml(item.priority)}` : ""}</p>
      ${notes}
      <div class="tag-row">${tags}</div>
      ${itemActions(item)}
    </li>
  `;
}

function flashPanel(flash) {
  if (!flash) return "";
  const stats = (flash.stats ?? [])
    .map((stat) => `<div class="stat"><span>${escapeHtml(stat.label)}</span><strong>${escapeHtml(stat.value)}</strong></div>`)
    .join("");
  return `
    <section class="flash-panel kind-${escapeAttr(flash.kind || "note")}" data-flash>
      <p class="eyebrow">${escapeHtml(flash.title || "Update")}</p>
      <p>${escapeHtml(flash.body || "")}</p>
      ${stats ? `<div class="stat-row">${stats}</div>` : ""}
    </section>
  `;
}

export function renderDashboard(items) {
  const open = openItems(items);
  const cards = SPRITES.map((sprite, index) => {
    const count = openCountFor(sprite.id, items);
    return `
      <a class="sprite-card accent-${sprite.accent}" href="${sprite.path}" data-link style="--delay:${index * 70}ms">
        ${spriteFigure(sprite, "md")}
        <div class="card-copy">
          <h2>${sprite.name}</h2>
          <p>${sprite.tagline}</p>
          <span class="chip open-count">${count} open</span>
        </div>
      </a>
    `;
  }).join("");

  const hopperItems = open
    .slice()
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .slice(0, 8);
  const nameById = Object.fromEntries(SPRITES.map((sprite) => [sprite.id, sprite.name]));

  const hopper = `
    <section class="todo-dock">
      <div class="dock-sprite" aria-hidden="true">
        <div class="sleepy-tray live-tray">
          <span class="zzz z1">!</span>
          <span class="zzz z2">•</span>
        </div>
      </div>
      <div class="dock-copy">
        <h2>Todo hopper</h2>
        <p>${open.length} open across the crew. Local JSON desks — complete or snooze from a sprite room.</p>
        <ul class="hopper-list">
          ${hopperItems
            .map(
              (item) => `
            <li>
              <a href="/sprites/${encodeURIComponent(item.botId)}" data-link>
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(nameById[item.botId] || item.botId)}${item.due ? ` · ${escapeHtml(item.due)}` : ""}</span>
              </a>
            </li>
          `,
            )
            .join("")}
        </ul>
      </div>
    </section>
  `;

  return shell(
    `
      <section class="hero">
        <p class="eyebrow">Good stretch, crew</p>
        <h1>Your sprites are awake and wiggling.</h1>
        <p class="lede">A playful local HQ for the Grok bots that help Jacob. Each room keeps its own brand — teal-amber, coral-cream, ink and sage, wood, jazz blue, forest green.</p>
      </section>
      ${hopper}
      <section>
        <div class="section-head">
          <h2>Sprite overview</h2>
          <p>Six assistants. Open counts come from <code>public/data/items.json</code>.</p>
        </div>
        <div class="sprite-grid">${cards}</div>
      </section>
    `,
    "/",
  );
}

export function renderSprite(sprite, items, flash) {
  const openCount = items.filter((item) => item.status === "open").length;
  const ordered = items.slice().sort((a, b) => {
    const rank = { open: 0, snoozed: 1, done: 2 };
    const delta = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
    if (delta) return delta;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });

  const list = ordered.length
    ? `<ul class="item-list">${ordered.map((item) => itemCard(item)).join("")}</ul>`
    : `
      <div class="empty-desk">
        <div class="empty-desk-art" aria-hidden="true">
          ${spriteFigure(sprite, "sm")}
          <div class="blank-page"></div>
        </div>
        <h3>Desk is clear</h3>
        <p>No items for <strong>${sprite.name}</strong> yet.</p>
      </div>
    `;

  const primary = (sprite.actions ?? [])
    .map(
      (action) => `
        <button type="button" class="btn btn-primary" data-action="sprite" data-sprite-action="${escapeAttr(action.id)}" title="${escapeAttr(action.hint || action.label)}">${escapeHtml(action.label)}</button>
      `,
    )
    .join("");

  return shell(
    `
      <a class="back" href="/" data-link>← Back to the nursery</a>
      <section class="sprite-hero accent-${sprite.accent}" data-brand="${escapeAttr(sprite.accent)}">
        ${spriteFigure(sprite, "lg")}
        <div>
          <p class="eyebrow">${sprite.name}</p>
          <h1>${sprite.tagline}</h1>
          <p class="lede">${sprite.vibe}</p>
          <p class="brand-line">Brand: ${escapeHtml(sprite.brand.labels.join(" + "))} · <code>${escapeHtml(sprite.brand.primary)}</code></p>
          <div class="action-bar" data-bot="${escapeAttr(sprite.id)}">
            <button type="button" class="btn btn-complete" data-action="complete-first">完成</button>
            <button type="button" class="btn btn-snooze" data-action="snooze-first">延後</button>
            ${primary}
          </div>
        </div>
      </section>
      ${flashPanel(flash)}
      <div class="sprite-panels">
        <section class="panel">
          <h2>Desk <span class="chip open-count">${openCount} open</span></h2>
          ${list}
        </section>
        <aside class="panel schema-peek">
          <h2>Item field kit</h2>
          <p>Shared schema for every sprite:</p>
          <pre>{
  id, title, status,
  botId, due, tags,
  notes, priority, updatedAt
}</pre>
          <ul class="field-list">
            ${ITEM_FIELDS.map((field) => `<li><code>${field}</code></li>`).join("")}
          </ul>
          <p class="muted">Status is <code>open</code>, <code>done</code>, or <code>snoozed</code>. Shared buttons: ${SHARED_ACTIONS.map((action) => action.label).join(" / ")}.</p>
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
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

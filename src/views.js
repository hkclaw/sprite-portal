import { fieldKitFor, hopperHint, priorityLabel, statusLabel } from "./schema.js";
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
          <small>Jacob 嘅本地精靈苗圃</small>
        </span>
      </a>
      <nav class="sprite-rail" aria-label="精靈導覽">${nav}</nav>
    </header>
    <main class="stage">${content}</main>
    <div class="toast" id="toast" hidden></div>
  `;
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

function formatFieldValue(field, value) {
  if (value === undefined || value === null || value === "") return "";
  if (field.key === "priority") return priorityLabel(value);
  if (field.key === "studyReady") return value === true ? "就緒" : "未就緒";
  if (field.key === "urgent") return value === true ? "緊急" : "唔急";
  if (typeof value === "boolean") return value ? "係" : "唔係";
  if (Array.isArray(value)) return value.join("、");
  return String(value);
}

function personaFields(item, botId) {
  return fieldKitFor(botId)
    .map((field) => {
      const text = formatFieldValue(field, item[field.key]);
      if (!text) return "";
      return `<span class="field-pill"><em>${escapeHtml(field.label)}</em> ${escapeHtml(text)}</span>`;
    })
    .filter(Boolean)
    .join("");
}

function itemCard(item, spriteName) {
  const who = spriteName ? `<span class="item-who">${escapeHtml(spriteName)}</span>` : "";
  const fields = personaFields(item, item.botId);
  const accent = item.urgent === true || item.priority === "high" || item.when === "過期" ? "priority-high" : "";
  return `
    <li class="item-card status-${item.status} ${accent}">
      <div class="item-top">
        <h3>${escapeHtml(item.title || "無標題")}</h3>
        <span class="chip status-chip">${statusLabel(item.status)}</span>
      </div>
      <p class="muted">${who}${who ? " · " : ""}${escapeHtml(statusLabel(item.status))}</p>
      <div class="field-row">${fields}</div>
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
      <p class="eyebrow">${escapeHtml(flash.title || "更新")}</p>
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
          <span class="chip open-count">${count} 張未完成</span>
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
        <h2>執漏欄</h2>
        <p>全組仲有 ${open.length} 張未完成。本地 JSON 書枱——入房就可以完成或延後。</p>
        <ul class="hopper-list">
          ${hopperItems
            .map(
              (item) => `
            <li>
              <a href="/sprites/${encodeURIComponent(item.botId)}" data-link>
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(nameById[item.botId] || item.botId)}${hopperHint(item) ? ` · ${escapeHtml(hopperHint(item))}` : ""}</span>
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
        <p class="eyebrow">各位，伸個懶腰先</p>
        <h1>精靈醒晒，喺度郁緊。</h1>
        <p class="lede">Jacob 嘅 Grok 機械人本地總部。每間房有自己品牌色——青綠琥珀、珊瑚奶油、墨紙鼠尾草、木色、爵士藍、森林綠。</p>
      </section>
      ${hopper}
      <section>
        <div class="section-head">
          <h2>精靈一覽</h2>
          <p>六位助手。未完成數目來自 <code>public/data/items.json</code>。</p>
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
        <h3>書枱清空咗</h3>
        <p>而家未有 <strong>${sprite.name}</strong> 嘅卡片。</p>
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
      <a class="back" href="/" data-link>← 返回苗圃</a>
      <section class="sprite-hero accent-${sprite.accent}" data-brand="${escapeAttr(sprite.accent)}">
        ${spriteFigure(sprite, "lg")}
        <div>
          <p class="eyebrow">${sprite.name}</p>
          <h1>${sprite.tagline}</h1>
          <p class="lede">${sprite.vibe}</p>
          <p class="brand-line">品牌色：${escapeHtml(sprite.brand.labels.join(" + "))} · <code>${escapeHtml(sprite.brand.primary)}</code></p>
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
          <h2>書枱 <span class="chip open-count">${openCount} 張未完成</span></h2>
          <p class="persona-kit">${fieldKitFor(sprite.id)
            .map(
              (field) =>
                `<span class="kit-label">${escapeHtml(field.label)}${field.hint ? ` <small>${escapeHtml(field.hint)}</small>` : ""}</span>`,
            )
            .join("")}</p>
          ${list}
        </section>
      </div>
      <p class="desk-foot muted">狀態：<code>未完成</code>、<code>完成</code> 或 <code>延後</code>。共用掣：${SHARED_ACTIONS.map((action) => action.label).join("／")}。</p>
    `,
    sprite.path,
  );
}

export function renderNotFound() {
  return shell(
    `
      <section class="hero">
        <h1>呢隻精靈走失咗。</h1>
        <p class="lede">呢度冇傳送門。返去苗圃啦。</p>
        <a class="back" href="/" data-link>← 總覽</a>
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

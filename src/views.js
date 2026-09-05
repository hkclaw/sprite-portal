import { barChart, countByStatus, todayOverdueCounts } from "./charts.js";
import { fieldKitFor, hopperHint, priorityLabel, statusLabel } from "./schema.js";
import { SHARED_ACTIONS, SPRITES } from "./sprites.js";
import { openCountFor, openItems } from "./store.js";

function spriteFigure(sprite, size = "xs") {
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

function shell(content, activePath, items = []) {
  const homeCurrent = activePath === "/" ? "is-current" : "";
  const nav = SPRITES.map((sprite) => {
    const current = activePath === sprite.path ? "is-current" : "";
    const open = openCountFor(sprite.id, items);
    return `
      <a class="nav-sprite ${current}" href="${sprite.path}" data-link title="${sprite.name}">
        ${spriteFigure(sprite, "xs")}
        <span class="nav-copy">
          <em>${sprite.name}</em>
          <small>${open} 張未完成</small>
        </span>
      </a>
    `;
  }).join("");

  return `
    <div class="app">
      <aside class="sidebar">
        <a class="brand" href="/" data-link>
          <span class="brand-mark" aria-hidden="true"></span>
          <span>
            <strong>Sprite Portal</strong>
            <small>Jacob 嘅本地精靈苗圃</small>
          </span>
        </a>
        <nav class="side-nav" aria-label="精靈導覽">
          <a class="nav-page ${homeCurrent}" href="/" data-link>總覽</a>
          <p class="nav-label">精靈</p>
          ${nav}
        </nav>
      </aside>
      <main class="page">
        ${content}
      </main>
    </div>
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
  if (field.key === "urgent") return value === true ? "urgent" : "唔急";
  if (typeof value === "boolean") return value ? "係" : "唔係";
  if (Array.isArray(value)) return value.join("、");
  return String(value);
}

function deskTable(items, botId) {
  const fields = fieldKitFor(botId);
  if (!items.length) return "";
  const head = `
    <tr>
      <th>標題</th>
      <th>狀態</th>
      ${fields.map((field) => `<th>${escapeHtml(field.label)}</th>`).join("")}
      <th></th>
    </tr>
  `;
  const body = items
    .map((item) => {
      const accent = item.urgent === true || item.priority === "high" || item.when === "Overdue" ? "is-alert" : "";
      return `
        <tr class="status-${item.status} ${accent}">
          <td class="cell-title">${escapeHtml(item.title || "無標題")}</td>
          <td><span class="chip">${statusLabel(item.status)}</span></td>
          ${fields
            .map((field) => `<td>${escapeHtml(formatFieldValue(field, item[field.key]) || "—")}</td>`)
            .join("")}
          <td class="cell-actions">${itemActions(item)}</td>
        </tr>
      `;
    })
    .join("");
  return `<div class="table-wrap"><table class="desk-table">${head}${body}</table></div>`;
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

function dashboardCharts(items) {
  const counts = countByStatus(items);
  const when = todayOverdueCounts(items);
  const bySprite = SPRITES.map((sprite) => ({
    label: sprite.name,
    value: openCountFor(sprite.id, items),
    color: sprite.brand.primary,
  }));
  return `
    <div class="chart-grid">
      ${barChart(
        [
          { label: "未完成", value: counts.open, color: "#148F8A" },
          { label: "完成", value: counts.done, color: "#8FAF88" },
          { label: "延後", value: counts.snoozed, color: "#C9A24A" },
        ],
        { title: "完成趨勢", note: "本地 JSON 書枱現況" },
      )}
      ${barChart(
        [
          { label: "Today", value: when.today, color: "#148F8A" },
          { label: "Overdue", value: when.overdue, color: "#E07A5F" },
        ],
        { title: "今日／逾期", note: "TickTick When 欄位" },
      )}
      ${barChart(bySprite, { title: "各精靈未完成", note: "六位助手未完成數" })}
    </div>
  `;
}

function spriteCharts(sprite, items) {
  const counts = countByStatus(items);
  const completion = barChart(
    [
      { label: "未完成", value: counts.open, color: sprite.brand.primary },
      { label: "完成", value: counts.done, color: "#787774" },
      { label: "延後", value: counts.snoozed, color: "#C9A24A" },
    ],
    { title: "完成趨勢" },
  );

  if (sprite.id === "jacob") {
    const when = todayOverdueCounts(items);
    return `
      <div class="chart-grid">
        ${completion}
        ${barChart(
          [
            { label: "Today", value: when.today, color: "#148F8A" },
            { label: "Overdue", value: when.overdue, color: "#E07A5F" },
          ],
          { title: "今日／逾期", note: "TickTick When 欄位" },
        )}
      </div>
    `;
  }

  if (sprite.id === "jazz") {
    const rows = items
      .filter((item) => item.lPer100)
      .map((item) => ({
        label: String(item.station || item.title),
        value: Number(String(item.lPer100).replace(/[^\d.]/g, "")) || 0,
        color: "#1E4D8C",
      }));
    return `
      <div class="chart-grid">
        ${completion}
        ${barChart(rows, { title: "油耗 L/100", note: "入油紀錄 mock" })}
      </div>
    `;
  }

  if (sprite.id === "vitalpilot") {
    return `
      <div class="chart-grid">
        ${completion}
        ${barChart(
          [
            { label: "一", value: 7420, color: "#2D6A4F" },
            { label: "二", value: 8010, color: "#2D6A4F" },
            { label: "三", value: 6880, color: "#2D6A4F" },
            { label: "四", value: 8432, color: "#2D6A4F" },
            { label: "五", value: 6100, color: "#2D6A4F" },
          ],
          { title: "步數（mock）", note: "Garmin snapshot 活動，唔寫診斷" },
        )}
        ${barChart(
          [
            { label: "一", value: 7.2, color: "#95D5B2" },
            { label: "二", value: 6.8, color: "#95D5B2" },
            { label: "三", value: 7.5, color: "#95D5B2" },
            { label: "四", value: 7.0, color: "#95D5B2" },
            { label: "五", value: 6.5, color: "#95D5B2" },
          ],
          { title: "睡眠時數（mock）", note: "習慣筆記，唔存登入資料" },
        )}
      </div>
    `;
  }

  return `<div class="chart-grid">${completion}</div>`;
}

export function renderDashboard(items) {
  const open = openItems(items);
  const hopperItems = open
    .slice()
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .slice(0, 8);
  const nameById = Object.fromEntries(SPRITES.map((sprite) => [sprite.id, sprite.name]));
  const counts = countByStatus(items);
  const when = todayOverdueCounts(items);

  const hopperRows = hopperItems
    .map(
      (item) => `
      <tr>
        <td class="cell-title"><a href="/sprites/${encodeURIComponent(item.botId)}" data-link>${escapeHtml(item.title)}</a></td>
        <td>${escapeHtml(nameById[item.botId] || item.botId)}</td>
        <td>${escapeHtml(hopperHint(item) || "—")}</td>
        <td><span class="chip">${statusLabel(item.status)}</span></td>
      </tr>
    `,
    )
    .join("");

  const overviewRows = SPRITES.map((sprite) => {
    const count = openCountFor(sprite.id, items);
    return `
      <tr>
        <td class="cell-sprite">
          <a class="row-avatar" href="${sprite.path}" data-link>
            ${spriteFigure(sprite, "xs")}
            <span>${sprite.name}</span>
          </a>
        </td>
        <td>${sprite.tagline}</td>
        <td><span class="chip">${count} 張未完成</span></td>
      </tr>
    `;
  }).join("");

  return shell(
    `
      <header class="page-head">
        <p class="crumb">Sprite Portal</p>
        <h1>總覽</h1>
        <p class="lede">本地 JSON 書枱。全組 ${open.length} 張未完成 · Today ${when.today} · Overdue ${when.overdue}。</p>
        <div class="action-bar">
          <button type="button" class="btn" data-action="restore-seeds" title="清除本機覆寫，重新載入 items.json 種子">還原種子</button>
        </div>
      </header>
      <section class="stat-row">
        <div class="stat"><span>未完成</span><strong>${counts.open}</strong></div>
        <div class="stat"><span>完成</span><strong>${counts.done}</strong></div>
        <div class="stat"><span>Today</span><strong>${when.today}</strong></div>
        <div class="stat"><span>Overdue</span><strong>${when.overdue}</strong></div>
      </section>
      ${dashboardCharts(items)}
      <section class="panel">
        <div class="panel-head">
          <h2>執漏欄</h2>
          <p>入房就可以完成或延後。</p>
        </div>
        ${
          hopperItems.length
            ? `<div class="table-wrap">
                <table class="desk-table">
                  <tr><th>標題</th><th>精靈</th><th>摘要</th><th>狀態</th></tr>
                  ${hopperRows}
                </table>
              </div>`
            : `<div class="empty-hopper">
                <p class="empty-title">執漏欄暫時冇嘢</p>
                <p class="empty-sub">未完成卡片會喺度排隊。而家全部跟咗，可以休息一下。</p>
              </div>`
        }
      </section>
      <section class="panel">
        <div class="panel-head">
          <h2>精靈一覽</h2>
          <p>六位助手。未完成數目來自 <code>public/data/items.json</code>。</p>
        </div>
        <div class="table-wrap">
          <table class="desk-table">
            <tr><th>精靈</th><th>職責</th><th>未完成</th></tr>
            ${overviewRows}
          </table>
        </div>
      </section>
    `,
    "/",
    items,
  );
}

export function renderSprite(sprite, items, flash, allItems = items) {
  const openCount = items.filter((item) => item.status === "open").length;
  const ordered = items.slice().sort((a, b) => {
    const rank = { open: 0, snoozed: 1, done: 2 };
    const delta = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
    if (delta) return delta;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });

  const list = ordered.length
    ? deskTable(ordered, sprite.id)
    : `
      <div class="empty-desk">
        <div class="row-avatar" aria-hidden="true">${spriteFigure(sprite, "xs")}</div>
        <h3 class="empty-title">書枱清空咗</h3>
        <p class="empty-sub">而家未有 <strong>${sprite.name}</strong> 嘅卡片，可以開新卡。</p>
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
      <header class="page-head">
        <p class="crumb"><a href="/" data-link>總覽</a> / ${sprite.name}</p>
        <div class="title-row">
          <span class="page-avatar">${spriteFigure(sprite, "xs")}</span>
          <div>
            <h1>${sprite.name}</h1>
            <p class="lede">${sprite.tagline}</p>
          </div>
        </div>
        <p class="muted">${sprite.vibe} 品牌色：${escapeHtml(sprite.brand.labels.join(" + "))} · <code>${escapeHtml(sprite.brand.primary)}</code></p>
        <div class="action-bar" data-bot="${escapeAttr(sprite.id)}">
          <button type="button" class="btn btn-complete" data-action="complete-first">完成</button>
          <button type="button" class="btn btn-snooze" data-action="snooze-first">延後</button>
          ${primary}
          <button type="button" class="btn" data-action="restore-seeds" title="清除本機覆寫，重新載入 items.json 種子">還原種子</button>
        </div>
      </header>
      ${flashPanel(flash)}
      ${spriteCharts(sprite, items)}
      <section class="panel">
        <div class="panel-head">
          <h2>書枱</h2>
          <span class="chip">${openCount} 張未完成</span>
        </div>
        <p class="persona-kit">${fieldKitFor(sprite.id)
          .map(
            (field) =>
              `<span class="kit-label">${escapeHtml(field.label)}${field.hint ? ` <small>${escapeHtml(field.hint)}</small>` : ""}</span>`,
          )
          .join("")}</p>
        ${list}
      </section>
      <p class="desk-foot">狀態：未完成／完成／延後。共用掣：${SHARED_ACTIONS.map((action) => action.label).join("／")}。</p>
    `,
    sprite.path,
    allItems,
  );
}

export function renderNotFound(items = []) {
  return shell(
    `
      <header class="page-head">
        <h1>呢隻精靈走失咗。</h1>
        <p class="lede">呢度冇傳送門。返去總覽啦。</p>
        <a class="text-link" href="/" data-link>← 總覽</a>
      </header>
    `,
    "",
    items,
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

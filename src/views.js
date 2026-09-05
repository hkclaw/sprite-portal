import { barChart, countByStatus, todayOverdueCounts } from "./charts.js";
import { addFormFieldsFor, fieldKitFor, hopperHint, isOpen, priorityLabel, statusLabel } from "./schema.js";
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
  const buttons = [];
  if (item.status === "open") {
    buttons.push(
      `<button type="button" class="btn btn-complete" data-action="complete" data-item-id="${escapeAttr(item.id)}">完成</button>`,
    );
    buttons.push(
      `<button type="button" class="btn btn-snooze" data-action="snooze" data-item-id="${escapeAttr(item.id)}">延後</button>`,
    );
  }
  buttons.push(
    `<button type="button" class="btn btn-edit" data-action="edit-item" data-item-id="${escapeAttr(item.id)}">編輯</button>`,
  );
  if (typeof item.id === "string" && item.id.startsWith("local-")) {
    buttons.push(
      `<button type="button" class="btn btn-delete" data-action="delete-item" data-item-id="${escapeAttr(item.id)}">刪除</button>`,
    );
  }
  if (!buttons.length) return "";
  return `<div class="item-actions">${buttons.join("")}</div>`;
}

function deskFilterLabel(filter) {
  if (filter === "open") return "未完成";
  if (filter === "done") return "完成";
  if (filter === "snoozed") return "延後";
  return "";
}

/**
 * Desk-status filter chips. UI-only: caller filters the rendered list, the
 * overlay / cache / seeds are never touched. Module-level state in main.js
 * keeps the active filter across paint() so chip clicks feel sticky.
 * @param {"open"|"all"|"done"|"snoozed"} active
 */
function deskFilterChipsHtml(active) {
  const chips = [
    { value: "open", label: "未完成" },
    { value: "all", label: "全部" },
    { value: "done", label: "完成" },
    { value: "snoozed", label: "延後" },
  ];
  return `
    <div class="desk-filter" role="group" aria-label="書枱狀態篩選">
      ${chips
        .map((chip) => {
          const isActive = chip.value === active;
          return `<button type="button" class="desk-filter-chip${isActive ? " is-active" : ""}" data-action="desk-filter" data-filter="${escapeAttr(chip.value)}" aria-pressed="${isActive ? "true" : "false"}">${escapeHtml(chip.label)}</button>`;
        })
        .join("")}
    </div>
  `;
}

/**
 * Hopper filter chips. Reuses `.desk-filter` / `.desk-filter-chip` so the
 * look matches the sprite-room status chips exactly; only the action name
 * (data-action="hopper-filter") and labels differ. UI-only — never touches
 * the store. Module var + sessionStorage in main.js keep the choice sticky.
 * @param {"open"|"today"|"overdue"|"all"} active
 */
function hopperFilterChipsHtml(active) {
  const chips = [
    { value: "open", label: "未完成" },
    { value: "today", label: "Today" },
    { value: "overdue", label: "Overdue" },
    { value: "all", label: "全部" },
  ];
  return `
    <div class="desk-filter hopper-filter" role="group" aria-label="執漏欄篩選">
      ${chips
        .map((chip) => {
          const isActive = chip.value === active;
          return `<button type="button" class="desk-filter-chip${isActive ? " is-active" : ""}" data-action="hopper-filter" data-filter="${escapeAttr(chip.value)}" aria-pressed="${isActive ? "true" : "false"}">${escapeHtml(chip.label)}</button>`;
        })
        .join("")}
    </div>
  `;
}

/**
 * Source list for the hopper rows. Pure projection — never mutates `items`.
 *   open    → status === "open"
 *   today   → when === "Today" AND status === "open"
 *   overdue → when === "Overdue" AND status === "open"
 *   all     → any status (caller sorts by updatedAt and slices top 8)
 * @param {import("./schema.js").SpriteItem[]} items
 * @param {"open"|"today"|"overdue"|"all"} filter
 */
function hopperSource(items, filter) {
  if (filter === "today") {
    return items.filter((item) => item.when === "Today" && item.status === "open");
  }
  if (filter === "overdue") {
    return items.filter((item) => item.when === "Overdue" && item.status === "open");
  }
  if (filter === "all") {
    return items;
  }
  return items.filter((item) => item.status === "open");
}

/**
 * Filter-aware empty-state copy for the hopper. Keeps the existing default
 * vibe for `open` and says something honest for the other slices.
 * @type {Record<"open"|"today"|"overdue"|"all", { title: string, sub: string }>}
 */
const HOPPER_EMPTY = {
  open: {
    title: "執漏欄暫時冇嘢",
    sub: "未完成卡片會喺度排隊。而家全部跟咗，可以休息一下。",
  },
  today: {
    title: "今日冇未完成",
    sub: "今日冇未完成卡片，揀其他篩選或者加新嘅。",
  },
  overdue: {
    title: "冇逾期未完成",
    sub: "冇逾期未完成嘅卡片，揀其他篩選睇下。",
  },
  all: {
    title: "執漏欄暫時冇嘢",
    sub: "全部卡片都係空。加返一張先。",
  },
};

/**
 * Empty desk vibe, filter-aware so it tells the user which slice is empty.
 * @param {import("./sprites.js").Sprite} sprite
 * @param {"open"|"all"|"done"|"snoozed"} filter
 */
function deskEmptyHtml(sprite, filter) {
  const label = deskFilterLabel(filter);
  const title = filter === "all" ? "書枱清空咗" : `冇${label}卡片`;
  const sub =
    filter === "all"
      ? `而家未有 <strong>${sprite.name}</strong> 嘅卡片。`
      : `而家冇 <strong>${label}</strong> 嘅卡片，揀其他篩選或者加新嘅。`;
  return `
    <div class="empty-desk">
      <div class="row-avatar" aria-hidden="true">${spriteFigure(sprite, "xs")}</div>
      <h3 class="empty-title">${escapeHtml(title)}</h3>
      <p class="empty-sub">${sub}</p>
    </div>
  `;
}

/** Render a single persona field, prefilled with the current item value. */
function editPersonaFieldHtml(field, item) {
  const currentValue = item[field.key];
  if (field.kind === "checkbox") {
    const checked = currentValue === true ? "checked" : "";
    return `
      <label class="add-item-field add-item-check">
        <input type="checkbox" name="persona.${escapeAttr(field.key)}" value="true" ${checked} />
        <span>${escapeHtml(field.label)}</span>
      </label>
    `;
  }
  if (field.kind === "select") {
    const opts = (field.options ?? [])
      .map((opt) => {
        const sel = opt.value === currentValue ? "selected" : "";
        return `<option value="${escapeAttr(opt.value)}" ${sel}>${escapeHtml(opt.label)}</option>`;
      })
      .join("");
    return `
      <label class="add-item-field">
        <span>${escapeHtml(field.label)}</span>
        <select name="persona.${escapeAttr(field.key)}" class="add-item-select">
          <option value="">—</option>${opts}
        </select>
      </label>
    `;
  }
  const value = typeof currentValue === "string" ? escapeAttr(currentValue) : "";
  return `
    <label class="add-item-field">
      <span>${escapeHtml(field.label)}</span>
      <input type="text" name="persona.${escapeAttr(field.key)}" class="add-item-input" maxlength="120" value="${value}" />
    </label>
  `;
}

/**
 * Mirror `personaFieldsForDue` in reverse: pick the persona field that
 * actually holds the date for this bot so the 到期 date input prefill is
 * honest. english-edge's `nextClass` carries extra notes after the date
 * (e.g. "2026-09-08 咖啡店點餐"), so we slice to the first 10 chars —
 * anything else won't fit a `<input type="date">` and would just blank out.
 * @param {import("./schema.js").SpriteItem} item
 */
function duePrefillValue(item) {
  let raw;
  if (item.botId === "english-edge") {
    raw = item.nextClass;
  } else if (item.botId === "homepilot") {
    raw = item.deadline;
  } else {
    raw = item.due;
  }
  if (typeof raw !== "string") return "";
  return item.botId === "english-edge" ? raw.slice(0, 10) : raw;
}

/**
 * Inline edit form for a single item: title + due + the room's persona
 * fields, prefilled. Submitted via data-action="save-edit". Cancelled via
 * data-action="cancel-edit". No mutation happens until submit.
 * @param {import("./schema.js").SpriteItem} item
 * @param {string} botId
 */
function editFormHtml(item, botId) {
  const fields = addFormFieldsFor(botId);
  const personaHtml = fields.map((field) => editPersonaFieldHtml(field, item)).join("");
  const dueValue = escapeAttr(duePrefillValue(item));
  return `
    <form class="edit-item-form" data-action="save-edit" data-item-id="${escapeAttr(item.id)}" autocomplete="off">
      <div class="edit-item-fields">
        <label class="add-item-field">
          <span>標題</span>
          <input type="text" name="title" class="add-item-input" required maxlength="120" value="${escapeAttr(item.title || "")}" />
        </label>
        <label class="add-item-field">
          <span>到期</span>
          <input type="date" name="due" class="add-item-date" value="${dueValue}" />
        </label>
        ${fields.length ? `<div class="add-item-persona-fields">${personaHtml}</div>` : ""}
      </div>
      <div class="edit-item-actions">
        <button type="button" class="btn" data-action="cancel-edit">取消</button>
        <button type="submit" class="btn btn-primary">儲存</button>
      </div>
    </form>
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

function deskTable(items, botId, editingId = null) {
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
      const row = `
        <tr class="status-${item.status} ${accent}">
          <td class="cell-title">${escapeHtml(item.title || "無標題")}</td>
          <td><span class="chip">${statusLabel(item.status)}</span></td>
          ${fields
            .map((field) => `<td>${escapeHtml(formatFieldValue(field, item[field.key]) || "—")}</td>`)
            .join("")}
          <td class="cell-actions">${itemActions(item)}</td>
        </tr>
      `;
      if (editingId && item.id === editingId) {
        const cols = 3 + fields.length;
        return row + `
          <tr class="edit-row">
            <td colspan="${cols}">${editFormHtml(item, botId)}</td>
          </tr>
        `;
      }
      return row;
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

function addItemForm({ botId, includeSpritePicker = false }) {
  const spriteOptions = includeSpritePicker
    ? SPRITES.map(
        (sprite) => `<option value="${escapeAttr(sprite.id)}">${escapeHtml(sprite.name)}</option>`,
      ).join("")
    : "";
  const initialBot = includeSpritePicker ? (SPRITES[0]?.id ?? "") : (botId || "");
  const hiddenBot = includeSpritePicker
    ? ""
    : `<input type="hidden" name="botId" value="${escapeAttr(botId || "")}" />`;
  const select = includeSpritePicker
    ? `
        <label class="add-item-field">
          <span>精靈</span>
          <select name="botId" class="add-item-select">${spriteOptions}</select>
        </label>
      `
    : "";
  const personaHtml = includeSpritePicker
    ? `<div class="add-item-persona" data-persona-host data-bot="${escapeAttr(initialBot)}">${personaAddFieldsHtml(initialBot)}</div>`
    : personaAddFieldsHtml(botId);
  return `
    <form class="add-item-form" data-action="add-item" autocomplete="off">
      ${hiddenBot}
      ${select}
      <label class="add-item-field">
        <span>標題</span>
        <input type="text" name="title" class="add-item-input" placeholder="例：交電費單" required maxlength="120" />
      </label>
      <label class="add-item-field">
        <span>到期</span>
        <input type="date" name="due" class="add-item-date" />
      </label>
      ${personaHtml}
      <button type="submit" class="btn btn-primary">加事項</button>
    </form>
  `;
}

function personaInputHtml(field) {
  if (field.kind === "select") {
    const opts = (field.options ?? [])
      .map(
        (opt) =>
          `<option value="${escapeAttr(opt.value)}">${escapeHtml(opt.label)}</option>`,
      )
      .join("");
    return `
      <label class="add-item-field">
        <span>${escapeHtml(field.label)}</span>
        <select name="persona.${escapeAttr(field.key)}" class="add-item-select">
          <option value="">—</option>${opts}
        </select>
      </label>
    `;
  }
  if (field.kind === "checkbox") {
    return `
      <label class="add-item-field add-item-check">
        <input type="checkbox" name="persona.${escapeAttr(field.key)}" value="true" />
        <span>${escapeHtml(field.label)}</span>
      </label>
    `;
  }
  return `
    <label class="add-item-field">
      <span>${escapeHtml(field.label)}</span>
      <input type="text" name="persona.${escapeAttr(field.key)}" class="add-item-input" maxlength="120" />
    </label>
  `;
}

/**
 * Render the optional persona fields for a given sprite.
 * Used inline on each sprite room, and re-painted into the
 * `[data-persona-host]` container on Dashboard when the
 * 精靈 select changes.
 * @param {string} botId
 */
export function personaAddFieldsHtml(botId) {
  const fields = addFormFieldsFor(botId);
  if (!fields.length) return "";
  return `<div class="add-item-persona-fields" data-bot="${escapeAttr(botId)}">${fields.map(personaInputHtml).join("")}</div>`;
}

export function renderDashboard(items, opts = {}) {
  const hopperFilter = opts.hopperFilter ?? "open";
  const source = hopperSource(items, hopperFilter);
  const hopperItems = source
    .slice()
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .slice(0, 8);
  const open = openItems(items);
  const nameById = Object.fromEntries(SPRITES.map((sprite) => [sprite.id, sprite.name]));
  const counts = countByStatus(items);
  const when = todayOverdueCounts(items);
  const empty = HOPPER_EMPTY[hopperFilter] ?? HOPPER_EMPTY.open;

  // Map a hopper-filter value to the dashboard stat that mirrors it. `all`
  // intentionally leaves every stat dark so we don't mislead the user into
  // thinking one of the four counters is the active slice.
  const STAT_TO_HOPPER = {
    open: "open",
    today: "today",
    overdue: "overdue",
  };

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
        ${(() => {
          const openActive = hopperFilter === STAT_TO_HOPPER.open;
          const todayActive = hopperFilter === STAT_TO_HOPPER.today;
          const overdueActive = hopperFilter === STAT_TO_HOPPER.overdue;
          return `
            <div class="stat is-clickable${openActive ? " is-active" : ""}" data-action="hopper-filter" data-filter="open" role="button" tabindex="0" aria-pressed="${openActive ? "true" : "false"}" title="切換執漏欄到未完成">
              <span>未完成</span><strong>${counts.open}</strong>
            </div>
            <div class="stat"><span>完成</span><strong>${counts.done}</strong></div>
            <div class="stat is-clickable${todayActive ? " is-active" : ""}" data-action="hopper-filter" data-filter="today" role="button" tabindex="0" aria-pressed="${todayActive ? "true" : "false"}" title="切換執漏欄到今日">
              <span>Today</span><strong>${when.today}</strong>
            </div>
            <div class="stat is-clickable${overdueActive ? " is-active" : ""}" data-action="hopper-filter" data-filter="overdue" role="button" tabindex="0" aria-pressed="${overdueActive ? "true" : "false"}" title="切換執漏欄到逾期">
              <span>Overdue</span><strong>${when.overdue}</strong>
            </div>
          `;
        })()}
      </section>
      ${dashboardCharts(items)}
      <section class="panel">
        <div class="panel-head">
          <h2>加事項</h2>
          <p>揀一位精靈，新開一張本地卡。</p>
        </div>
        ${addItemForm({ includeSpritePicker: true })}
      </section>
      <section class="panel">
        <div class="panel-head">
          <h2>執漏欄</h2>
          <p>入房就可以完成或延後。</p>
        </div>
        ${hopperFilterChipsHtml(hopperFilter)}
        ${
          hopperItems.length
            ? `<div class="table-wrap">
                <table class="desk-table">
                  <tr><th>標題</th><th>精靈</th><th>摘要</th><th>狀態</th></tr>
                  ${hopperRows}
                </table>
              </div>`
            : `<div class="empty-hopper">
                <p class="empty-title">${escapeHtml(empty.title)}</p>
                <p class="empty-sub">${escapeHtml(empty.sub)}</p>
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

export function renderSprite(sprite, items, flash, allItems = items, opts = {}) {
  const deskFilter = opts.deskFilter ?? "open";
  const editingId = opts.editingId ?? null;
  const glanceExpanded = opts.expanded !== false;
  const openCount = items.filter((item) => item.status === "open").length;
  const ordered = items.slice().sort((a, b) => {
    const rank = { open: 0, snoozed: 1, done: 2 };
    const delta = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
    if (delta) return delta;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });

  const filtered = deskFilter === "all"
    ? ordered
    : ordered.filter((item) => item.status === deskFilter);

  const list = filtered.length
    ? deskTable(filtered, sprite.id, editingId)
    : deskEmptyHtml(sprite, deskFilter);

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
        ${glanceStripHtml(items, { botId: sprite.id, expanded: glanceExpanded })}
      </header>
      ${flashPanel(flash)}
      ${spriteCharts(sprite, items)}
      <section class="panel">
        <div class="panel-head">
          <h2>加事項</h2>
          <span class="chip">${sprite.name}</span>
        </div>
        ${addItemForm({ botId: sprite.id })}
      </section>
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
        ${deskFilterChipsHtml(deskFilter)}
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

/**
 * Per-bot glance chip projection. Pure: never mutates `items`, never
 * touches the store or seeds. Each sprite surfaces the few facts the
 * user would scan first when they land in the room — count chips for
 * Jacob/HomePilot/ChapterMind, the newest row's persona fields for the
 * rest. Empty arrays mean "no glance info yet"; the strip then renders
 * a friendly one-liner instead of a cloud of "—".
 * @param {import("./schema.js").SpriteItem[]} items
 * @param {string} botId
 * @returns {{ label: string, value: string }[]}
 */
function glanceChips(items, botId) {
  const open = items.filter(isOpen);
  const sortedByNewest = items
    .slice()
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const newestOpen = sortedByNewest.find(isOpen) ?? null;
  const newestAny = sortedByNewest[0] ?? null;

  switch (botId) {
    case "jacob": {
      const { today, overdue } = todayOverdueCounts(items);
      const high = open.filter((item) => item.priority === "high").length;
      const earliest = open
        .filter((item) => typeof item.due === "string" && item.due)
        .map((item) => item.due)
        .sort()[0];
      return [
        { label: "Today", value: String(today) },
        { label: "Overdue", value: String(overdue) },
        { label: "高優先", value: String(high) },
        { label: "到期", value: earliest || "—" },
      ];
    }
    case "english-edge": {
      if (!newestOpen) return [];
      const hasPrep = typeof newestOpen.prep === "string" && newestOpen.prep;
      return [
        { label: "下一堂", value: String(newestOpen.nextClass || "—") },
        { label: "grammar", value: String(newestOpen.grammar || "—") },
        { label: "vocab", value: String(newestOpen.vocab || "—") },
        {
          label: hasPrep ? "prep" : "speaking script status",
          value: String(hasPrep ? newestOpen.prep : newestOpen.scriptStatus || "—"),
        },
      ];
    }
    case "chaptermind": {
      const sortedOpen = open
        .slice()
        .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      const focused = sortedOpen.find((item) => item.shelf === "在讀") ?? sortedOpen[0] ?? null;
      // Wishlist count covers any status — the seed pins a done wishlist
      // item too, so an "open-only" count would understate the pile.
      const wishlist = items.filter((item) => item.shelf === "wishlist").length;
      if (!focused) {
        return [
          { label: "書架", value: "—" },
          { label: "進度", value: "—" },
          { label: "想討論呢段", value: "—" },
          { label: "wishlist", value: String(wishlist) },
        ];
      }
      const discuss = typeof focused.discuss === "string" ? focused.discuss : "";
      const trimmed = discuss.length > 48 ? `${discuss.slice(0, 48)}…` : discuss;
      return [
        { label: "書架", value: focused.shelf || "在讀" },
        { label: "進度", value: String(focused.progress || "—") },
        { label: "想討論呢段", value: trimmed || "—" },
        { label: "wishlist", value: String(wishlist) },
      ];
    }
    case "homepilot": {
      const urgent = open.filter((item) => item.urgent === true).length;
      const nearest = open
        .filter((item) => typeof item.deadline === "string" && item.deadline)
        .slice()
        .sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""))[0];
      return [
        { label: "urgent", value: String(urgent) },
        { label: "deadline", value: nearest ? String(nearest.deadline) : "—" },
        { label: "供應商", value: nearest ? String(nearest.vendor || "—") : "—" },
      ];
    }
    case "jazz": {
      const target = newestOpen ?? newestAny;
      if (!target) return [];
      const price = target.pricePerLiter;
      const countdown = target.oilCountdown;
      /** @type {{ label: string, value: string }[]} */
      const chips = [
        { label: "odo", value: String(target.odo || "—") },
        { label: "站", value: String(target.station || "—") },
        {
          label: "$/L",
          value: price === undefined || price === null || price === "" ? "—" : String(price),
        },
      ];
      if (countdown !== undefined && countdown !== null && countdown !== "") {
        chips.push({ label: "換油 countdown", value: String(countdown) });
      }
      return chips;
    }
    case "vitalpilot": {
      const target = newestOpen ?? newestAny;
      if (!target) return [];
      return [
        { label: "Garmin snapshot", value: String(target.garmin || "—") },
        { label: "活動", value: String(target.activity || "—") },
        { label: "秤重", value: String(target.weighIn || "—") },
        { label: "戒酒 streak", value: String(target.soberStreak || "—") },
      ];
    }
    default:
      return [];
  }
}

/**
 * Render the per-bot glance strip. Lives in the sprite-room page-head
 * right after the action bar. Never writes to the store / overlay /
 * seeds — `opts.expanded` is a UI-only hint whose persistence lives in
 * main.js (sessionStorage mirror of the hopper-filter pattern).
 * @param {import("./schema.js").SpriteItem[]} items
 * @param {{ botId?: string, expanded?: boolean }} [opts]
 */
function glanceStripHtml(items, opts = {}) {
  const botId = opts.botId || (items[0] && items[0].botId) || "";
  const expanded = opts.expanded !== false;
  const chips = glanceChips(items, botId);
  const hasChips = chips.length > 0;
  const body = hasChips
    ? `<div class="glance-chips">${chips
        .map(
          (chip) => `
        <span class="glance-chip">
          <span class="glance-chip-label">${escapeHtml(chip.label)}</span>
          <span class="glance-chip-value">${escapeHtml(chip.value)}</span>
        </span>`,
        )
        .join("")}</div>`
    : `<p class="glance-empty">${escapeHtml("呢度暫時冇速覽——書枱清清哋。")}</p>`;
  const toggleLabel = expanded ? "收埋" : "展開";
  return `
    <section class="glance-strip${expanded ? "" : " is-collapsed"}" data-glance data-bot="${escapeAttr(botId)}">
      <header class="glance-head">
        <span class="glance-eyebrow">精靈速覽</span>
        <button type="button" class="glance-toggle" data-action="glance-toggle" data-bot="${escapeAttr(botId)}" aria-expanded="${expanded ? "true" : "false"}" title="${expanded ? "收埋速覽" : "展開速覽"}">${escapeHtml(toggleLabel)}</button>
      </header>
      <div class="glance-body"${expanded ? "" : ' hidden=""'}>${body}</div>
    </section>
  `;
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

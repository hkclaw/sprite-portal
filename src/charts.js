/** Lightweight SVG bars — no chart library. */

function escape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * @param {{ label: string, value: number, color?: string }[]} rows
 * @param {{ title?: string, note?: string }} [opts]
 */
export function barChart(rows, opts = {}) {
  const max = Math.max(1, ...rows.map((row) => Number(row.value) || 0));
  const bars = rows.length
    ? rows
        .map((row) => {
          const value = Number(row.value) || 0;
          const pct = Math.max(4, Math.round((value / max) * 100));
          const color = row.color || "#2383e2";
          return `
            <div class="chart-row" aria-label="${escape(row.label)}: ${escape(value)}">
              <span class="chart-label">${escape(row.label)}</span>
              <div class="chart-track" aria-hidden="true">
                <i style="width:${pct}%;background:${color}"></i>
              </div>
              <span class="chart-value">${escape(value)}</span>
            </div>
          `;
        })
        .join("")
    : `<p class="chart-empty">暫時未有數據</p>`;

  return `
    <section class="chart-card">
      ${opts.title ? `<h3>${escape(opts.title)}</h3>` : ""}
      ${opts.note ? `<p class="chart-note">${escape(opts.note)}</p>` : ""}
      <div class="chart-bars">${bars}</div>
    </section>
  `;
}

export function countByStatus(items) {
  return {
    open: items.filter((item) => item.status === "open").length,
    done: items.filter((item) => item.status === "done").length,
    snoozed: items.filter((item) => item.status === "snoozed").length,
  };
}

export function todayOverdueCounts(items) {
  const today = items.filter((item) => item.when === "Today" && item.status === "open").length;
  const overdue = items.filter((item) => item.when === "Overdue" && item.status === "open").length;
  return { today, overdue };
}

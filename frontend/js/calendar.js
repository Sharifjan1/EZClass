// The weekly grid. Draws the classes in the active plan, plus a dashed
// "ghost" for whatever section the student is pointing at in the list.
// Overlapping classes are stacked with an offset and striped in red.

import { DAY_ORDER, DAY_NAMES, formatTime, formatRange, formatRangeShort, sectionsOverlap } from "./time.js";

export const SUBJECT_COLORS = 8; // --s0 ... --s7 in style.css

export function subjectColorIndex(subject, subjectOrder) {
  const i = subjectOrder.indexOf(subject);
  return (i < 0 ? 0 : i) % SUBJECT_COLORS;
}

const isTimed = (s) => Number.isFinite(s.startMin) && Number.isFinite(s.endMin) && s.dayList.length > 0;

// Splits one day's classes into lanes when they overlap.
function layoutDay(blocks) {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = [];
    const placed = cluster.map((b) => {
      let lane = lanes.findIndex((end) => end <= b.startMin);
      if (lane === -1) { lane = lanes.length; lanes.push(0); }
      lanes[lane] = b.endMin;
      return { s: b, lane };
    });
    for (const p of placed) out.push({ ...p, lanes: lanes.length });
    cluster = [];
  };
  for (const b of sorted) {
    if (cluster.length && b.startMin >= clusterEnd) flush();
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.endMin);
  }
  if (cluster.length) flush();
  return out;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderCalendar(container, opts) {
  const { sections = [], ghost = null, subjectOrder = [], animateIds = new Set(), selectedId = null, emptyText = "", busy = [], selectedBusy = null } = opts;
  const timed = sections.filter(isTimed);
  const ghostTimed = ghost && isTimed(ghost) && !sections.some((s) => s.id === ghost.id) ? ghost : null;
  const busyTimed = busy.filter(isTimed);
  const everything = [...timed, ...busyTimed, ...(ghostTimed ? [ghostTimed] : [])];

  const weekend = everything.some((s) => s.dayList.includes("Sa") || s.dayList.includes("Su"));
  const days = DAY_ORDER.filter((d) => weekend || (d !== "Sa" && d !== "Su"));

  let first = Math.min(8 * 60, ...everything.map((s) => s.startMin));
  let last = Math.max(18 * 60, ...everything.map((s) => s.endMin));
  first = Math.floor(first / 60) * 60;
  last = Math.ceil(last / 60) * 60;
  const span = last - first;
  const pct = (m) => ((m - first) / span) * 100;

  const hours = [];
  for (let m = first; m <= last; m += 60) hours.push(m);

  const cols = days.map((d) => {
    const todays = timed.filter((s) => s.dayList.includes(d));
    const busyToday = busyTimed.filter((b) => b.dayList.includes(d));
    const busyHtml = busyToday.map((b) => `<button type="button" class="busy${selectedBusy === b.id ? " selected" : ""}" data-busy="${esc(b.id)}"
        aria-label="${esc(`Busy: ${b.label}, ${DAY_NAMES[d]} ${formatRange(b)}. Edit`)}"
        style="top:${pct(b.startMin)}%;height:${pct(b.endMin) - pct(b.startMin)}%">
        <span class="blk-code">${esc(b.label)}</span><span class="blk-time">${esc(formatRangeShort(b))}</span></button>`).join("");
    const blocks = layoutDay(todays).map(({ s, lane, lanes }) => {
      const clash = todays.some((o) => sectionsOverlap(s, o)) || busyToday.some((b) => sectionsOverlap(s, b));
      const offset = lanes > 1 ? Math.min(18, 44 / (lanes - 1)) : 0;
      const cls = [
        "blk", `s${subjectColorIndex(s.subject, subjectOrder)}`,
        clash ? "clash" : "",
        animateIds.has(s.id) ? "pop" : "",
        selectedId === s.id ? "selected" : "",
      ].join(" ");
      const label = `${s.subject} ${s.catalog} section ${s.sectionLabel}, ${DAY_NAMES[d]} ${formatRange(s)}, ${s.room}${clash ? ", overlaps another class" : ""}`;
      return `<button type="button" class="${cls}" data-id="${esc(s.id)}" aria-label="${esc(label)}"
        style="top:${pct(s.startMin)}%;height:${pct(s.endMin) - pct(s.startMin)}%;left:calc(${lane * offset}% + 3px);width:calc(${100 - (lanes - 1) * offset}% - 6px);z-index:${2 + lane}">
        <span class="blk-code">${esc(s.subject)} ${esc(s.catalog)}</span>
        <span class="blk-time">${esc(formatRangeShort(s))}</span>
        <span class="blk-room">${esc(s.room)}</span>
      </button>`;
    }).join("");

    let ghostHtml = "";
    if (ghostTimed && ghostTimed.dayList.includes(d)) {
      const clash = todays.some((o) => sectionsOverlap(ghostTimed, o)) || busyToday.some((b) => sectionsOverlap(ghostTimed, b));
      ghostHtml = `<div class="ghost s${subjectColorIndex(ghostTimed.subject, subjectOrder)}${clash ? " clash" : ""}" aria-hidden="true"
        style="top:${pct(ghostTimed.startMin)}%;height:${pct(ghostTimed.endMin) - pct(ghostTimed.startMin)}%">
        <span class="blk-code">${esc(ghostTimed.subject)} ${esc(ghostTimed.catalog)}</span>
        <span class="blk-time">${clash ? "Overlaps" : esc(formatRangeShort(ghostTimed))}</span>
      </div>`;
    }
    return `<div class="cal-col" role="group" aria-label="${DAY_NAMES[d]}" data-day="${d}">${busyHtml}${blocks}${ghostHtml}</div>`;
  }).join("");

  const untimed = sections.filter((s) => !isTimed(s));
  const anyClash = timed.some((a) => timed.some((b) => sectionsOverlap(a, b)) || busyTimed.some((b) => sectionsOverlap(a, b)));

  container.innerHTML = `
    <div class="cal" style="--days:${days.length};--hours:${span / 60}">
      <div class="cal-corner"></div>
      ${days.map((d) => `<div class="cal-dayhead"><span class="long">${DAY_NAMES[d].slice(0, 3)}</span><span class="short">${d}</span></div>`).join("")}
      <div class="cal-gutter">${hours.map((m) => `<span style="top:${pct(m)}%">${formatTime(m)}</span>`).join("")}</div>
      <div class="cal-body" style="grid-column: 2 / -1" data-first="${first}" data-span="${span}">
        <div class="cal-lines">${hours.slice(1, -1).map((m) => `<i style="top:${pct(m)}%"></i>`).join("")}</div>
        <div class="cal-cols">${cols}</div>
        ${!sections.length && !busyTimed.length && !ghostTimed && emptyText ? `<p class="cal-empty">${emptyText}</p>` : ""}
      </div>
    </div>
    ${anyClash ? `<p class="cal-key"><span class="key-swatch" aria-hidden="true"></span>Striped red classes overlap another class or one of your busy times.</p>` : ""}
    ${untimed.length ? `<p class="cal-key">Not on the grid (no set meeting time): ${untimed.map((s) => esc(`${s.subject} ${s.catalog}`)).join(", ")}</p>` : ""}
  `;
}

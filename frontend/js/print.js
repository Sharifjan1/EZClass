// Print view: a clean, one-page sheet of the current plan. It holds a
// header (term, plan, date), a black-and-white friendly week grid, a table
// of every class, week stats, busy times, and any overlaps. The sheet is
// built into #print-sheet, and the @media print rules in style.css hide
// everything else, so the browser's print dialog (or "Save as PDF")
// only gets this sheet.

import { DAY_ORDER, DAY_NAMES, formatTime, formatRange, formatRangeShort, findConflicts, sectionsOverlap } from "./time.js";
import { weekStats, formatDuration } from "./stats.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isTimed = (s) => Number.isFinite(s.startMin) && Number.isFinite(s.endMin) && s.dayList.length > 0;
const code = (s) => `${s.subject} ${s.catalog}`;
const dayCodes = (s) => s.dayList.join("") || "—";

function byCourse(a, b) {
  return a.subject.localeCompare(b.subject) || (a.catalogNum || 0) - (b.catalogNum || 0) ||
    String(a.catalog).localeCompare(String(b.catalog)) || String(a.sectionLabel).localeCompare(String(b.sectionLabel));
}

/* ---------- week grid ---------- */

// Overlapping classes on one day sit side by side instead of on top of each other.
function lanes(list) {
  const sorted = [...list].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out = [];
  let cluster = [], ends = [], clusterEnd = -1;
  const flush = () => { for (const c of cluster) out.push({ ...c, count: ends.length }); cluster = []; ends = []; };
  for (const s of sorted) {
    if (cluster.length && s.startMin >= clusterEnd) flush();
    let lane = ends.findIndex((e) => e <= s.startMin);
    if (lane === -1) { lane = ends.length; ends.push(0); }
    ends[lane] = s.endMin;
    cluster.push({ s, lane });
    clusterEnd = Math.max(clusterEnd, s.endMin);
  }
  if (cluster.length) flush();
  return out;
}

function gridHtml(sections, busy, colorOf) {
  const timed = sections.filter(isTimed);
  const busyTimed = busy.filter(isTimed);
  const all = [...timed, ...busyTimed];
  if (!all.length) return "";

  const weekend = all.some((s) => s.dayList.includes("Sa") || s.dayList.includes("Su"));
  const days = DAY_ORDER.filter((d) => weekend || (d !== "Sa" && d !== "Su"));
  const first = Math.floor(Math.min(8 * 60, ...all.map((s) => s.startMin)) / 60) * 60;
  const last = Math.ceil(Math.max(17 * 60, ...all.map((s) => s.endMin)) / 60) * 60;
  const span = last - first;
  const pct = (m) => ((m - first) / span) * 100;

  const hours = [];
  for (let m = first; m <= last; m += 60) hours.push(m);

  const cols = days.map((d) => {
    const busyHtml = busyTimed.filter((b) => b.dayList.includes(d)).map((b) => `
      <div class="pr-busy" style="top:${pct(b.startMin)}%;height:${pct(b.endMin) - pct(b.startMin)}%">
        <b>${esc(b.label)}</b><span>${esc(formatRangeShort(b))}</span></div>`).join("");
    const todays = timed.filter((s) => s.dayList.includes(d));
    const blocks = lanes(todays).map(({ s, lane, count }) => {
      const clash = todays.some((o) => sectionsOverlap(s, o)) || busyTimed.some((b) => b.dayList.includes(d) && sectionsOverlap(s, b));
      const w = 100 / count;
      return `
      <div class="pr-blk ${colorOf(s.subject)}${clash ? " clash" : ""}" style="top:${pct(s.startMin)}%;height:${pct(s.endMin) - pct(s.startMin)}%;left:calc(${lane * w}% + 2pt);width:calc(${w}% - 4pt)">
        <b>${esc(code(s))}</b><span>${esc(formatRangeShort(s))}</span><span>${esc(s.room)}</span></div>`;
    }).join("");
    return `<div class="pr-col">${busyHtml}${blocks}</div>`;
  }).join("");

  return `
  <div class="pr-grid" style="--days:${days.length}">
    <div class="pr-corner"></div>
    ${days.map((d) => `<div class="pr-dayhead">${DAY_NAMES[d].slice(0, 3)}</div>`).join("")}
    <div class="pr-gutter">${hours.map((m) => `<span style="top:${pct(m)}%">${formatTime(m)}</span>`).join("")}</div>
    <div class="pr-body">
      ${hours.slice(1, -1).map((m) => `<i style="top:${pct(m)}%"></i>`).join("")}
      <div class="pr-cols">${cols}</div>
    </div>
  </div>`;
}

/* ---------- class table ---------- */

function tableHtml(sections, colorOf) {
  const rows = [...sections].sort(byCourse).map((s) => `
    <tr>
      <td><span class="pr-dot ${colorOf(s.subject)}"></span>${esc(code(s))}</td>
      <td>${esc(s.title)}</td>
      <td>${esc(s.sectionLabel)}</td>
      <td>${esc(dayCodes(s))}</td>
      <td>${esc(formatRange(s) || "TBA")}</td>
      <td>${esc(s.room)}</td>
      <td>${esc(s.professor)}</td>
      <td class="num">${s.units ?? "—"}</td>
    </tr>`).join("");
  const units = sections.reduce((n, s) => n + (s.units || 0), 0);
  return `
  <table class="pr-table">
    <thead><tr><th>Course</th><th>Title</th><th>Sec</th><th>Days</th><th>Time</th><th>Room</th><th>Professor</th><th class="num">Units</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="7">${sections.length} ${sections.length === 1 ? "class" : "classes"}</td><td class="num">${units}</td></tr></tfoot>
  </table>`;
}

/* ---------- stats, busy times, overlaps ---------- */

function statsHtml(st) {
  const items = [
    ["Units", st.units || "—"],
    ["Hours in class", `${Math.round(st.hoursInClass * 10) / 10} / week`],
    ["Days on campus", st.days.length ? `${st.days.length} (${st.days.join(" ")})` : "—"],
    ["First class", st.earliest != null ? formatTime(st.earliest) : "—"],
    ["Last class ends", st.latest != null ? formatTime(st.latest) : "—"],
    ["Longest gap", st.longestGap ? formatDuration(st.longestGap) : "None"],
  ];
  return `<dl class="pr-stats">${items.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;
}

function notesHtml(sections, busy) {
  const out = [];
  const pairs = findConflicts(sections.filter(isTimed));
  const busyHits = [];
  for (const s of sections.filter(isTimed)) for (const b of busy) if (sectionsOverlap(s, b)) busyHits.push([s, b]);

  if (pairs.length || busyHits.length) {
    out.push(`<section class="pr-note bad"><h3>Overlaps to fix</h3><ul>
      ${pairs.map(([a, b]) => `<li>${esc(code(a))} (${esc(dayCodes(a))} ${esc(formatRange(a))}) overlaps ${esc(code(b))} (${esc(dayCodes(b))} ${esc(formatRange(b))})</li>`).join("")}
      ${busyHits.map(([s, b]) => `<li>${esc(code(s))} runs into busy time "${esc(b.label)}"</li>`).join("")}
    </ul></section>`);
  } else if (sections.length > 1) {
    out.push(`<p class="pr-ok">No overlaps in this plan.</p>`);
  }

  const st = weekStats(sections);
  if (st.tightWalks.length) {
    out.push(`<section class="pr-note"><h3>Tight walks</h3><ul>
      ${st.tightWalks.map((w) => `<li>${esc(w.days.join(" "))}: ${esc(code(w.from))} to ${esc(code(w.to))}, ${w.gap} min between buildings</li>`).join("")}
    </ul></section>`);
  }

  if (busy.length) {
    const sorted = [...busy].sort((a, b) => DAY_ORDER.indexOf(a.dayList[0]) - DAY_ORDER.indexOf(b.dayList[0]) || a.startMin - b.startMin);
    out.push(`<section class="pr-note"><h3>Busy times</h3><ul>
      ${sorted.map((b) => `<li>${esc(b.label)}: ${esc(b.dayList.join(" "))} ${esc(formatRange(b))}</li>`).join("")}
    </ul></section>`);
  }

  const untimed = sections.filter((s) => !isTimed(s));
  if (untimed.length) {
    out.push(`<p class="pr-small">No set meeting time (not on the grid): ${untimed.map((s) => esc(code(s))).join(", ")}</p>`);
  }
  return out.join("");
}

/* ---------- the whole sheet ---------- */

// opts: { planName, termLabel, sections, busy, colorOf(subject) -> class name, url }
export function buildPrintSheet({ planName, termLabel, sections, busy = [], colorOf = () => "s0", url = "" }) {
  const realBusy = busy.filter((b) => !b.draft);
  const printed = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  return `
  <header class="pr-head">
    <div>
      <p class="pr-brand">EzClass</p>
      <h1>${esc(termLabel)} schedule <span>· ${esc(planName)}</span></h1>
    </div>
    <p class="pr-date">Printed ${esc(printed)}</p>
  </header>
  ${statsHtml(weekStats(sections))}
  ${gridHtml(sections, realBusy, colorOf)}
  ${tableHtml(sections, colorOf)}
  ${notesHtml(sections, realBusy)}
  <footer class="pr-foot">
    <span>Made with EzClass. Check section numbers in the SDSU portal before you register.</span>
    ${url ? `<span class="pr-url">${esc(url)}</span>` : ""}
  </footer>`;
}

// Fills #print-sheet and opens the print dialog. The page title becomes the
// suggested file name when someone picks "Save as PDF".
export function printSheet(html, fileTitle) {
  const sheet = document.getElementById("print-sheet");
  if (!sheet) return;
  sheet.innerHTML = html;
  const oldTitle = document.title;
  document.title = fileTitle;
  document.body.classList.add("printing");
  const done = () => {
    document.title = oldTitle;
    document.body.classList.remove("printing");
    sheet.innerHTML = "";
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  // Give the browser a frame to lay out the sheet before the dialog opens.
  requestAnimationFrame(() => setTimeout(() => window.print(), 30));
}

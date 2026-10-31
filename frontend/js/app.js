// EzClass planner: filters, the course list, auto-build, plans, the week
// grid, and export. Data comes from api.js; nothing here knows the JSON shape.

import * as api from "./api.js";
import { DAY_NAMES, formatTime, formatRange, sectionsOverlap, findConflicts, sharedDays } from "./time.js";
import { renderCalendar, subjectColorIndex } from "./calendar.js";
import { weekStats, formatDuration } from "./stats.js";
import { buildSchedules, courseKey, MAX_RESULTS } from "./builder.js";
import { buildICS } from "./ics.js";
import * as store from "./store.js";
import { initHero, initDrawOnScroll } from "./hero.js";
import { initRouter, goHome, currentPage, onPageChange } from "./router.js";
import { POSTS } from "./content.js";
import { createPalette, score } from "./palette.js";

const WEEKDAYS = ["M", "T", "W", "Th", "F"];
const PREVIEW_BUILD = Boolean(window.EZCLASS_PREVIEW); // one-file preview: downloads are blocked there

const state = {
  subjects: [],
  sections: [],
  filters: { picked: new Set(), days: new Set(), upperOnly: false, professor: "", keyword: "", sort: "course" },
  term: store.loadTerm(),
  plans: null, // filled in below for the current term
  ghost: null,
  selectedId: null,
  animateIds: new Set(),
  checkResult: null,
  finderTab: "browse",
  mobileView: "find",
  build: {
    courses: [],
    prefs: { earliest: null, latest: null, daysOff: new Set(), sortBy: "days", keepPlan: false },
    result: null,
    previewIndex: null,
  },
  undo: null,
  busy: [],            // busy times for this term
  selectedBusy: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const code = (s) => `${s.subject} ${s.catalog}`;
const plan = () => state.plans.plans[state.plans.active];
const schedule = () => plan().sections;
const inPlan = (id) => schedule().some((s) => s.id === id);
const busyHits = (s) => state.busy.filter((b) => !b.draft && sectionsOverlap(s, b));
let lastDragEnd = 0; // the click that ends a drag shouldn't close the editor it opens
// Subjects in the plan get the first colors, so classes on the grid never share a color.
const subjectOrder = () => [...new Set([...shownSections().map((s) => s.subject), ...state.subjects])];
const colorClass = (subject) => `s${subjectColorIndex(subject, subjectOrder())}`;
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// The sections shown on the grid right now: an auto-build preview, or the plan.
function shownSections() {
  const b = state.build;
  if (b.previewIndex != null && b.result?.schedules[b.previewIndex]) {
    const keep = b.prefs.keepPlan ? schedule() : [];
    return [...keep, ...b.result.schedules[b.previewIndex].sections];
  }
  return schedule();
}

/* ======================= Filters ======================= */

function visibleSections() {
  const f = state.filters;
  const rows = state.sections
    .filter((s) => !f.picked.size || f.picked.has(s.subject))
    .filter((s) => !f.days.size || (s.dayList.length > 0 && s.dayList.every((d) => f.days.has(d))))
    .filter((s) => !f.upperOnly || (s.catalogNum >= 300 && s.catalogNum <= 599));
  return rows;
}

function activeFilterCount() {
  const f = state.filters;
  return f.picked.size + (f.days.size ? 1 : 0) + (f.upperOnly ? 1 : 0) + (f.professor ? 1 : 0) + (f.keyword ? 1 : 0);
}

function renderFilters() {
  const f = state.filters;
  $("#subject-chips").innerHTML = state.subjects.map((s) =>
    `<button type="button" class="chip" data-subject="${esc(s)}" aria-pressed="${f.picked.has(s)}"><span class="chip-dot ${colorClass(s)}" aria-hidden="true"></span>${esc(s)}</button>`).join("");
  $("#day-toggles").innerHTML = dayToggleHtml(f.days, "free");
  $("#f-upper").checked = f.upperOnly;
  const n = activeFilterCount();
  $("#filters-count").textContent = n ? String(n) : "";
  $("#reset-btn").hidden = n === 0;
}

function dayToggleHtml(set, kind) {
  return WEEKDAYS.map((d) => `<button type="button" class="daybtn" data-day="${d}" data-kind="${kind}" aria-pressed="${set.has(d)}" aria-label="${DAY_NAMES[d]}" title="${DAY_NAMES[d]}">${d}</button>`).join("");
}

function resetFilters() {
  const f = state.filters;
  f.picked.clear(); f.days.clear(); f.upperOnly = false; f.professor = ""; f.keyword = "";
  $("#f-keyword").value = "";
  $("#f-professor").value = "";
  renderFilters();
  refreshSections();
}

/* ======================= Course list ======================= */

let requestNo = 0;

async function refreshSections() {
  const n = ++requestNo;
  $("#results").setAttribute("aria-busy", "true");
  try {
    const rows = await api.fetchSections({
      term: termLabel(),
      subjects: [...state.filters.picked],
      professor: state.filters.professor,
      q: state.filters.keyword,
    });
    if (n !== requestNo) return;
    state.sections = rows;
    renderResults();
  } catch (err) {
    if (n !== requestNo) return;
    $("#results").innerHTML = `<div class="empty"><p class="empty-title">Couldn't load sections</p>
      <p>${esc(err.message)}. Check that the Flask server is running, then change a filter to try again.</p></div>`;
    $("#result-count").textContent = "";
  } finally {
    if (n === requestNo) $("#results").removeAttribute("aria-busy");
  }
}

function dayPills(s) {
  return `<span class="pills" aria-label="${esc(s.dayList.map((d) => DAY_NAMES[d]).join(", ") || "No set days")}">${WEEKDAYS.map((d) =>
    `<i class="${s.dayList.includes(d) ? "on" : ""}">${d}</i>`).join("")}</span>`;
}

function renderResults() {
  const rows = visibleSections();
  const groups = new Map();
  for (const s of rows) {
    const k = courseKey(s);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }

  const sort = state.filters.sort;
  const list = [...groups.entries()].map(([k, secs]) => {
    secs.sort((a, b) => (a.startMin || 9999) - (b.startMin || 9999) || a.sectionLabel.localeCompare(b.sectionLabel, undefined, { numeric: true }));
    return { k, secs, first: secs[0] };
  });
  list.sort((a, b) => {
    if (sort === "start") return Math.min(...a.secs.map((s) => s.startMin)) - Math.min(...b.secs.map((s) => s.startMin));
    if (sort === "units") return (b.first.units || 0) - (a.first.units || 0) || a.k.localeCompare(b.k);
    return a.first.subject.localeCompare(b.first.subject) || a.first.catalogNum - b.first.catalogNum || a.k.localeCompare(b.k);
  });

  $("#result-count").textContent = rows.length
    ? `${rows.length} ${rows.length === 1 ? "section" : "sections"} in ${list.length} ${list.length === 1 ? "course" : "courses"}`
    : "";

  if (!rows.length) {
    $("#results").innerHTML = `<div class="empty">
      <p class="empty-title">No sections match</p>
      <p>Try fewer filters. Drop a day or a subject, or turn off "Upper division only".</p>
      <button type="button" class="btn btn-quiet" data-action="reset">Reset filters</button></div>`;
    return;
  }

  $("#results").innerHTML = list.map(({ k, secs, first }) => `
    <article class="course" data-course="${esc(k)}">
      <header class="course-head">
        <span class="code ${colorClass(first.subject)}">${esc(k)}</span>
        <h3>${esc(first.title)}</h3>
        <span class="course-meta">${first.units ? `${first.units} units, ` : ""}${secs.length} ${secs.length === 1 ? "section" : "sections"}</span>
      </header>
      <ul class="secs">${secs.map(sectionRow).join("")}</ul>
    </article>`).join("");
}

function sectionRow(s) {
  const added = inPlan(s.id);
  const clashes = added ? [] : schedule().filter((p) => sectionsOverlap(s, p));
  const busyClash = busyHits(s);
  const sameCourse = !added && schedule().find((p) => courseKey(p) === courseKey(s));
  let note = "";
  const parts = [
    ...clashes.map((c) => `${esc(code(c))} (${esc(c.sectionLabel)})`),
    ...busyClash.map((b) => `your ${esc(b.label)} time`),
  ];
  if (parts.length) note = `<span class="sec-note bad">Overlaps ${parts.join(", ")}</span>`;
  else if (sameCourse) note = `<span class="sec-note">You already have section ${esc(sameCourse.sectionLabel)}</span>`;

  return `<li class="sec${added ? " added" : ""}${parts.length ? " clash" : ""}" data-id="${esc(s.id)}">
    <span class="sec-num">Sec ${esc(s.sectionLabel)}</span>
    ${dayPills(s)}
    <span class="sec-time">${esc(formatRange(s) || "TBA")}</span>
    <a class="sec-prof" href="${api.rmpLink(s.professor)}" target="_blank" rel="noopener" title="Look up ${esc(s.professor)} on RateMyProfessors">${esc(s.professor)}</a>
    <span class="sec-room">${esc(s.room)}</span>
    ${note}
    <button type="button" class="btn-add" data-action="toggle" data-id="${esc(s.id)}" aria-pressed="${added}"
      aria-label="${added ? "Remove" : "Add"} ${esc(code(s))} section ${esc(s.sectionLabel)}">${added ? `<span class="idle">Added</span><span class="hover">Remove</span>` : "Add"}</button>
  </li>`;
}

/* ======================= Plan changes ======================= */

function remember(label) {
  state.undo = { label, plans: JSON.parse(JSON.stringify(state.plans)) };
}

function addSection(s) {
  if (!s || inPlan(s.id)) return;
  schedule().push(s);
  state.animateIds = new Set([s.id]);
  planChanged();
  toast(`Added ${code(s)} section ${s.sectionLabel} to ${plan().name}.`);
}

function removeSection(id, quiet = false) {
  const s = schedule().find((x) => x.id === id);
  if (!s) return;
  remember("remove");
  plan().sections = schedule().filter((x) => x.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  planChanged();
  if (!quiet) toast(`Removed ${code(s)} section ${s.sectionLabel}.`, true);
}

function planChanged({ keepAnimation = false } = {}) {
  state.checkResult = null;
  store.savePlans(state.term, state.plans);
  renderWeek();
  renderResults();
  if (!keepAnimation) state.animateIds = new Set();
}

function undo() {
  if (!state.undo) return;
  state.plans = state.undo.plans;
  state.undo = null;
  planChanged();
  toast("Change undone.");
}

/* ======================= Week panel ======================= */

function renderWeek() {
  const previewing = state.build.previewIndex != null;
  const shown = shownSections();

  // plan tabs
  const ps = state.plans;
  $("#plan-tabs").innerHTML = ps.plans.map((p, i) => `
    <button type="button" class="plan-tab" role="tab" data-plan="${i}" aria-selected="${i === ps.active}">
      ${esc(p.name)} <span class="count">${p.sections.length || ""}</span></button>`).join("") +
    (ps.plans.length < store.MAX_PLANS ? `<button type="button" class="plan-add" data-action="add-plan" aria-label="Start a new plan">+ New plan</button>` : "");

  // preview banner
  const banner = $("#preview-banner");
  banner.hidden = !previewing;
  if (previewing) {
    const total = state.build.result.schedules.length;
    $("#preview-label").textContent = `Previewing option ${state.build.previewIndex + 1} of ${total}`;
    $("#preview-prev").disabled = state.build.previewIndex === 0;
    $("#preview-next").disabled = state.build.previewIndex >= total - 1;
  }

  renderCalendar($("#calendar"), {
    sections: shown,
    ghost: previewing ? null : state.ghost,
    subjectOrder: subjectOrder(),
    animateIds: state.animateIds,
    selectedId: state.selectedId,
    busy: state.busy,
    selectedBusy: state.selectedBusy,
    emptyText: window.matchMedia("(hover: hover)").matches
      ? "Point at a section in the list to see it here. Click Add to keep it."
      : "Tap Add on any section in Find and it lands here.",
  });

  renderStats(shown);
  renderPicks(shown, previewing);
  renderGuide(previewing);
  renderBusyList(previewing);
  $("#compare-btn").hidden = state.plans.plans.length < 2 || previewing;
  $("#drag-hint").hidden = previewing || !window.matchMedia("(hover: hover)").matches;

  const n = shown.length;
  for (const el of $$(".week-count")) el.textContent = schedule().length ? String(schedule().length) : "";
  $("#check-btn").disabled = (n < 2 && !(n === 1 && state.busy.length)) || previewing;
  $("#export-btn").disabled = !n || previewing;
  $("#share-btn").disabled = !n || previewing;
  $("#clear-btn").hidden = !schedule().length || previewing;
  $("#delete-plan-btn").hidden = ps.plans.length < 2 || previewing;
  $(".week-actions").hidden = previewing;
  renderCheck();
}

function renderStats(sections) {
  const st = weekStats(sections);
  const box = $("#stats");
  if (!sections.length) { box.innerHTML = ""; box.hidden = true; $("#walk-note").hidden = true; return; }
  box.hidden = false;
  const items = [
    ["Units", st.units ? String(st.units) : "–"],
    ["In class", `${formatDuration(Math.round(st.hoursInClass * 60))} a week`],
    ["On campus", st.days.length ? st.days.join(" ") : "–"],
    ["First class", st.earliest != null ? formatTime(st.earliest) : "–"],
    ["Longest gap", formatDuration(st.longestGap)],
    ["Tight walks", String(st.tightWalks.length)],
  ];
  box.innerHTML = items.map(([k, v]) => `<div${k === "Tight walks" && st.tightWalks.length ? ' class="warn"' : ""}><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");

  const note = $("#walk-note");
  const DAY_NAMES = { M: "Monday", T: "Tuesday", W: "Wednesday", Th: "Thursday", F: "Friday", Sa: "Saturday", Su: "Sunday" };
  const w = st.tightWalks[0];
  if (!w) { note.hidden = true; note.textContent = ""; return; }
  const more = st.tightWalks.length > 1 ? ` You have ${st.tightWalks.length - 1} more like this.` : "";
  const days = w.days.map((d) => DAY_NAMES[d] || d).join(" and ");
  note.textContent = `Tight walk on ${days}: ${code(w.from)} ends at ${formatTime(w.from.endMin)} in ${w.from.room}, and ${code(w.to)} starts ${w.gap} minutes later in ${w.to.room}.${more}`;
  note.hidden = false;
}

function renderPicks(sections, previewing) {
  const list = $("#picks");
  if (!sections.length) {
    list.innerHTML = "";
    return;
  }
  const clashing = new Set([...findConflicts(sections).flat().map((s) => s.id), ...sections.filter((s) => busyHits(s).length).map((s) => s.id)]);
  list.innerHTML = sections.map((s) => `
    <li class="pick${clashing.has(s.id) ? " clash" : ""}${state.selectedId === s.id ? " selected" : ""}">
      <span class="swatch ${colorClass(s.subject)}" aria-hidden="true"></span>
      <span class="pick-main"><strong>${esc(code(s))}</strong> <span class="muted">sec ${esc(s.sectionLabel)}</span>
        <span class="pick-title">${esc(s.title)}</span></span>
      <span class="pick-when">${esc(s.days || "TBA")} ${esc(formatRange(s))}</span>
      ${previewing ? "" : `<button type="button" class="link-btn" data-action="remove" data-id="${esc(s.id)}" aria-label="Remove ${esc(code(s))} section ${esc(s.sectionLabel)}">Remove</button>`}
    </li>`).join("");
}

async function runCheck() {
  const btn = $("#check-btn");
  btn.disabled = true;
  btn.textContent = "Checking…";
  const secs = schedule();
  const byId = new Map(secs.map((s) => [s.id, s]));
  const local = () => findConflicts(secs).map(([a, b]) => [a.id, b.id, ""]);
  try {
    const pairs = await api.checkSchedule(secs.map((s) => s.id), local);
    state.checkResult = {
      pairs: pairs.map(([a, b, note]) => [byId.get(a), byId.get(b), note]).filter(([a, b]) => a && b),
      busy: secs.flatMap((s) => busyHits(s).map((b) => [s, b])),
    };
  } catch (err) {
    state.checkResult = { error: err.message };
  }
  btn.textContent = "Check for conflicts";
  btn.disabled = secs.length < 1;
  renderCheck(true);
}

function renderCheck(fresh = false) {
  const box = $("#check-result");
  const r = state.checkResult;
  if (!r || state.build.previewIndex != null) { box.hidden = true; return; }
  box.hidden = false;
  const icon = (ok) => `<svg class="check-icon${fresh ? " draw-now" : ""}" viewBox="0 0 28 28" aria-hidden="true">
    <circle cx="14" cy="14" r="12" pathLength="1"/>${ok
      ? `<path d="M8.5 14.5l3.8 4 7.2-8.5" pathLength="1"/>`
      : `<path d="M9.5 9.5l9 9M18.5 9.5l-9 9" pathLength="1"/>`}</svg>`;
  if (r.error) {
    box.className = "check-result bad";
    box.innerHTML = `${icon(false)}<div><p><strong>The check didn't run.</strong> ${esc(r.error)}</p></div>`;
  } else if (!r.pairs.length && !r.busy?.length) {
    box.className = "check-result good";
    box.innerHTML = `${icon(true)}<div><p><strong>No overlaps.</strong> All ${schedule().length} classes fit together.</p></div>`;
  } else {
    box.className = "check-result bad";
    const n = r.pairs.length + (r.busy?.length || 0);
    const days = (a, b) => sharedDays(a, b).map((d) => DAY_NAMES[d].slice(0, 3)).join(", ");
    box.innerHTML = `${icon(false)}<div><p><strong>${n} ${n === 1 ? "overlap" : "overlaps"} found.</strong> ${r.pairs.length ? "Remove one class from each pair." : "Pick a different section or move the busy time."}</p>
      <ul>${r.pairs.map(([a, b, note]) => {
        const when = note || days(a, b);
        return `<li>${esc(code(a))} (${esc(a.sectionLabel)}) and ${esc(code(b))} (${esc(b.sectionLabel)})${when ? ` on ${esc(when)}` : ""}</li>`;
      }).join("")}${(r.busy || []).map(([s, b]) =>
        `<li>${esc(code(s))} (${esc(s.sectionLabel)}) and your ${esc(b.label)} time on ${esc(days(s, b))}</li>`).join("")}</ul></div>`;
  }
}

/* ======================= Block popover ======================= */

function openPopover(id, anchor) {
  const s = shownSections().find((x) => x.id === id);
  const pop = $("#popover");
  if (!s) return closePopover();
  state.selectedId = id;
  const previewing = state.build.previewIndex != null;
  pop.innerHTML = `
    <p class="pop-code"><span class="code ${colorClass(s.subject)}">${esc(code(s))}</span> <span class="muted">Section ${esc(s.sectionLabel)}</span></p>
    <p class="pop-title">${esc(s.title)}</p>
    <dl class="pop-facts">
      <div><dt>When</dt><dd>${esc(s.dayList.map((d) => DAY_NAMES[d].slice(0, 3)).join(", "))}, ${esc(formatRange(s))}</dd></div>
      <div><dt>Where</dt><dd>${esc(s.room)}</dd></div>
      <div><dt>Professor</dt><dd><a href="${api.rmpLink(s.professor)}" target="_blank" rel="noopener">${esc(s.professor)}</a></dd></div>
      ${s.units ? `<div><dt>Units</dt><dd>${s.units}</dd></div>` : ""}
    </dl>
    <div class="pop-actions">
      ${previewing ? "" : `<button type="button" class="btn btn-quiet" data-action="remove" data-id="${esc(s.id)}">Remove from plan</button>`}
      <button type="button" class="btn btn-quiet" data-action="close-pop">Close</button>
    </div>`;
  state.selectedBusy = null;
  positionPopover(anchor, 280);
  renderWeek();
  pop.querySelector("button")?.focus({ preventScroll: true });
}

// Places the shared popover beside whatever opened it, inside the week panel.
function positionPopover(anchor, width) {
  const pop = $("#popover");
  pop.hidden = false;
  const week = $("#week");
  const host = week.getBoundingClientRect();
  const a = anchor.getBoundingClientRect();
  const pw = Math.min(width, host.width - 24);
  let left = a.right - host.left + 8;
  if (left + pw > host.width - 12) left = a.left - host.left - pw - 8;
  left = Math.max(12, Math.min(left, host.width - pw - 12));
  let top = a.top - host.top + week.scrollTop;
  pop.style.left = `${left}px`;
  pop.style.width = `${pw}px`;
  pop.style.top = `${Math.max(12, top)}px`;
  // Keep it inside the panel when the anchor is near the bottom.
  const overflow = pop.offsetTop + pop.offsetHeight - (week.scrollHeight - 12);
  if (overflow > 0) pop.style.top = `${Math.max(12, pop.offsetTop - overflow)}px`;
}

function closePopover() {
  if ($("#popover").hidden && state.selectedId == null && state.selectedBusy == null) return;
  // Closing the editor of a brand-new busy time without saving throws it away.
  const draft = state.busy.find((b) => b.id === state.selectedBusy && b.draft);
  if (draft) state.busy = state.busy.filter((b) => b !== draft);
  $("#popover").hidden = true;
  state.selectedId = null;
  state.selectedBusy = null;
  renderWeek();
  renderResults();
}

/* ======================= Busy times ======================= */

const BUSY_NAMES = ["Work", "Practice", "Commute", "Lab hours", "Family"];

function timeOptions(selected, from = 6 * 60, to = 23 * 60) {
  let html = "";
  for (let m = from; m <= to; m += 15) html += `<option value="${m}"${m === selected ? " selected" : ""}>${formatTime(m)}</option>`;
  return html;
}

function newBusyId() {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function startBusy(dayList, startMin, endMin, anchor) {
  const b = { id: newBusyId(), label: "Busy", dayList, startMin, endMin, draft: true };
  state.busy.push(b);
  state.selectedId = null;
  renderWeek();
  const block = $(`.busy[data-busy="${b.id}"]`) || anchor;
  openBusyEditor(b.id, block);
}

function openBusyEditor(id, anchor) {
  const b = state.busy.find((x) => x.id === id);
  if (!b) return;
  state.selectedBusy = id;
  state.selectedId = null;
  const pop = $("#popover");
  pop.innerHTML = `
    <p class="pop-title">${b.draft ? "Block out a busy time" : "Edit busy time"}</p>
    <p class="hint">Classes that land here get flagged, and Auto-build skips this time.</p>
    <label class="field" for="busy-label"><span class="field-label">What is it?</span>
      <input type="text" id="busy-label" value="${esc(b.draft && b.label === "Busy" ? "" : b.label)}" placeholder="Work, practice, commute" maxlength="30"></label>
    <div class="busy-quick">${BUSY_NAMES.map((n) => `<button type="button" class="chip" data-busy-name="${n}">${n}</button>`).join("")}</div>
    <fieldset class="field"><legend class="field-label">Days</legend>
      <div class="days">${WEEKDAYS.map((d) => `<button type="button" class="daybtn" data-bday="${d}" aria-pressed="${b.dayList.includes(d)}" aria-label="${DAY_NAMES[d]}">${d}</button>`).join("")}</div>
    </fieldset>
    <div class="busy-times">
      <label class="field" for="busy-start"><span class="field-label">From</span><select id="busy-start">${timeOptions(b.startMin)}</select></label>
      <label class="field" for="busy-end"><span class="field-label">To</span><select id="busy-end">${timeOptions(b.endMin)}</select></label>
    </div>
    <p class="hint bad-text" id="busy-error" hidden></p>
    <div class="pop-actions">
      <button type="button" class="btn btn-red btn-sm" id="busy-save">Save</button>
      <button type="button" class="btn btn-quiet btn-sm" id="busy-delete">${b.draft ? "Cancel" : "Delete"}</button>
    </div>`;
  positionPopover(anchor, 300);
  renderWeek();

  const days = new Set(b.dayList);
  pop.querySelectorAll("[data-bday]").forEach((btn) => btn.addEventListener("click", () => {
    const d = btn.dataset.bday;
    days.has(d) ? days.delete(d) : days.add(d);
    btn.setAttribute("aria-pressed", String(days.has(d)));
  }));
  pop.querySelectorAll("[data-busy-name]").forEach((btn) => btn.addEventListener("click", () => {
    $("#busy-label").value = btn.dataset.busyName;
  }));
  $("#busy-save").addEventListener("click", () => {
    const start = Number($("#busy-start").value);
    const end = Number($("#busy-end").value);
    const err = $("#busy-error");
    if (!days.size) { err.textContent = "Pick at least one day."; err.hidden = false; return; }
    if (end <= start) { err.textContent = "The end time has to be after the start time."; err.hidden = false; return; }
    Object.assign(b, {
      label: $("#busy-label").value.trim() || "Busy",
      dayList: WEEKDAYS.filter((d) => days.has(d)),
      days: WEEKDAYS.filter((d) => days.has(d)).join(""),
      startMin: start, endMin: end,
    });
    const wasNew = b.draft;
    delete b.draft;
    store.saveBusy(state.term, state.busy);
    state.checkResult = null;
    $("#popover").hidden = true;
    state.selectedBusy = null;
    renderWeek();
    renderResults();
    if (state.build.result) runBuild();
    const hits = schedule().filter((s) => sectionsOverlap(s, b));
    toast(hits.length
      ? `${wasNew ? "Added" : "Saved"} ${b.label}. It overlaps ${hits.map((s) => code(s)).join(", ")}.`
      : `${wasNew ? "Added" : "Saved"} ${b.label}. Auto-build will work around it.`);
  });
  $("#busy-delete").addEventListener("click", () => {
    const wasNew = b.draft;
    state.busy = state.busy.filter((x) => x.id !== b.id);
    store.saveBusy(state.term, state.busy);
    $("#popover").hidden = true;
    state.selectedBusy = null;
    state.checkResult = null;
    renderWeek();
    renderResults();
    if (!wasNew) toast(`Deleted ${b.label}.`);
  });
  $("#busy-label").focus({ preventScroll: true });
}

function renderBusyList(previewing) {
  const box = $("#busy-list");
  const saved = state.busy.filter((b) => !b.draft);
  box.hidden = previewing || !saved.length;
  if (box.hidden) return;
  box.innerHTML = `<p class="busy-head">Busy times</p><ul>${saved.map((b) => `
    <li><span class="busy-swatch" aria-hidden="true"></span><span class="busy-name">${esc(b.label)}</span>
      <span class="pick-when">${esc(b.dayList.join(" "))} ${esc(formatRange(b))}</span>
      <button type="button" class="link-btn" data-action="edit-busy" data-busy-id="${esc(b.id)}">Edit</button></li>`).join("")}</ul>`;
}

// Press and drag on an empty part of the grid to draw a busy time.
function wireBusyDrag() {
  const cal = $("#calendar");
  let drag = null;
  const minuteAt = (body, y) => {
    const r = body.getBoundingClientRect();
    const first = Number(body.dataset.first);
    const span = Number(body.dataset.span);
    const m = first + ((y - r.top) / r.height) * span;
    return Math.max(first, Math.min(first + span, Math.round(m / 15) * 15));
  };
  cal.addEventListener("pointerdown", (e) => {
    const col = e.target.closest(".cal-col");
    if (!col || e.target.closest(".blk, .busy") || e.pointerType === "touch" || e.button !== 0) return;
    if (state.build.previewIndex != null) return;
    const body = col.closest(".cal-body");
    const start = minuteAt(body, e.clientY);
    const el = document.createElement("div");
    el.className = "busy draft";
    col.append(el);
    drag = { col, body, start, end: start + 15, el };
    const paint = () => {
      const first = Number(body.dataset.first), span = Number(body.dataset.span);
      const a = Math.min(drag.start, drag.end), b = Math.max(drag.start, drag.end);
      el.style.top = `${((a - first) / span) * 100}%`;
      el.style.height = `${((b - a) / span) * 100}%`;
      el.innerHTML = `<span class="blk-time">${formatTime(a)}–${formatTime(b)}</span>`;
    };
    drag.paint = paint;
    paint();
    col.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  cal.addEventListener("pointermove", (e) => {
    if (!drag) return;
    drag.end = minuteAt(drag.body, e.clientY);
    drag.paint();
  });
  const finish = (e) => {
    if (!drag) return;
    const { col, start, end, el } = drag;
    drag = null;
    let a = Math.min(start, end), b = Math.max(start, end);
    if (b - a < 30) b = a + 60; // a plain click makes a one-hour block
    el.remove();
    if (e.type === "pointercancel") return;
    lastDragEnd = Date.now();
    startBusy([col.dataset.day], a, b, col);
  };
  cal.addEventListener("pointerup", finish);
  cal.addEventListener("pointercancel", finish);
}

function addBusyFromButton() {
  startBusy([], 13 * 60, 17 * 60, $("#busy-btn"));
}

/* ======================= Compare plans ======================= */

function openCompare() {
  const plans = state.plans.plans;
  const rows = plans.map((p) => {
    const st = weekStats(p.sections);
    const overlaps = findConflicts(p.sections).length + p.sections.reduce((n, s) => n + busyHits(s).length, 0);
    return { p, st, overlaps };
  });
  const best = (key, pick) => {
    const vals = rows.filter((r) => r.p.sections.length).map((r) => pick(r));
    return vals.length ? Math.min(...vals) : null;
  };
  const fewestDays = best("days", (r) => r.st.days.length);
  const leastGap = best("gap", (r) => r.st.gapMinutes);
  const cell = (val, isBest) => `<td${isBest ? ' class="best"' : ""}>${esc(val)}</td>`;

  $("#compare-grid").innerHTML = `
    <div class="compare-scroll"><table class="compare-table">
      <thead><tr><th scope="col"><span class="sr-only">Measure</span></th>${rows.map((r, i) => `<th scope="col">
        <span class="compare-name">${esc(r.p.name)}${i === state.plans.active ? ' <span class="muted">(open)</span>' : ""}</span>
        ${miniWeek(r.p.sections).replace('class="mini"', 'class="mini mini-lg"')}</th>`).join("")}</tr></thead>
      <tbody>
        <tr><th scope="row">Classes</th>${rows.map((r) => cell(String(r.p.sections.length), false)).join("")}</tr>
        <tr><th scope="row">Units</th>${rows.map((r) => cell(r.st.units ? String(r.st.units) : "–", false)).join("")}</tr>
        <tr><th scope="row">Days on campus</th>${rows.map((r) => cell(r.st.days.length ? `${r.st.days.length} (${r.st.days.join(" ")})` : "–", r.p.sections.length && r.st.days.length === fewestDays)).join("")}</tr>
        <tr><th scope="row">In class</th>${rows.map((r) => cell(`${formatDuration(Math.round(r.st.hoursInClass * 60))} a week`, false)).join("")}</tr>
        <tr><th scope="row">First class</th>${rows.map((r) => cell(r.st.earliest != null ? formatTime(r.st.earliest) : "–", false)).join("")}</tr>
        <tr><th scope="row">Last class ends</th>${rows.map((r) => cell(r.st.latest != null ? formatTime(r.st.latest) : "–", false)).join("")}</tr>
        <tr><th scope="row">Gaps between classes, per week</th>${rows.map((r) => cell(formatDuration(r.st.gapMinutes), r.p.sections.length && r.st.gapMinutes === leastGap)).join("")}</tr>
        <tr><th scope="row">Tight walks</th>${rows.map((r) => cell(r.p.sections.length ? String(r.st.tightWalks.length) : "–", false)).join("")}</tr>
        <tr><th scope="row">Overlaps</th>${rows.map((r) => `<td class="${r.overlaps ? "bad" : "good"}">${r.overlaps ? r.overlaps : "None"}</td>`).join("")}</tr>
        <tr><th scope="row"><span class="sr-only">Open</span></th>${rows.map((r, i) => `<td><button type="button" class="btn btn-quiet btn-sm" data-compare-open="${i}">Open ${esc(r.p.name)}</button></td>`).join("")}</tr>
      </tbody>
    </table></div>
    <p class="hint">Green marks the plan with the fewest days on campus and the shortest gaps between classes.</p>`;
  $("#compare-dialog").showModal();
}

/* ======================= Auto-build ======================= */

function allCourseOptions() {
  const m = new Map();
  for (const s of state.allSections) {
    const k = courseKey(s);
    if (!m.has(k)) m.set(k, { key: k, title: s.title, subject: s.subject, count: 0 });
    m.get(k).count++;
  }
  return [...m.values()].sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}

function renderBuild() {
  const b = state.build;
  const options = allCourseOptions();
  $("#b-courses").innerHTML = b.courses.length
    ? b.courses.map((k) => {
      const o = options.find((x) => x.key === k);
      return `<li class="b-course"><span class="code ${colorClass(o?.subject || k.split(" ")[0])}">${esc(k)}</span>
        <span class="b-course-title">${esc(o?.title || "")}</span>
        <span class="muted">${o ? `${o.count} ${o.count === 1 ? "section" : "sections"}` : "not found"}</span>
        <button type="button" class="link-btn" data-action="b-remove" data-course="${esc(k)}" aria-label="Remove ${esc(k)}">Remove</button></li>`;
    }).join("")
    : `<li class="b-empty">No courses yet. Add a few above, or <button type="button" class="link-btn" data-action="example">try an example</button>.</li>`;

  $("#b-days").innerHTML = dayToggleHtml(b.prefs.daysOff, "off");
  $("#b-run").disabled = b.courses.length === 0;
  renderBuildResults();
}

function renderBuildSuggestions() {
  const q = $("#b-input").value.trim().toLowerCase();
  const box = $("#b-suggest");
  if (!q) { box.hidden = true; box.innerHTML = ""; return; }
  const hits = allCourseOptions()
    .filter((o) => !state.build.courses.includes(o.key))
    .filter((o) => `${o.key} ${o.title}`.toLowerCase().includes(q) || o.key.replace(" ", "").toLowerCase().includes(q.replace(/\s/g, "")))
    .slice(0, 6);
  box.hidden = !hits.length;
  $("#b-input").setAttribute("aria-expanded", String(Boolean(hits.length)));
  box.innerHTML = hits.map((o, i) => `<li role="option" id="b-opt-${i}" data-course="${esc(o.key)}" aria-selected="${i === 0}">
    <span class="code ${colorClass(o.subject)}">${esc(o.key)}</span> ${esc(o.title)}</li>`).join("");
}

function addBuildCourse(k) {
  if (!k || state.build.courses.includes(k)) return;
  state.build.courses.push(k);
  state.build.result = null;
  exitPreview(false);
  $("#b-input").value = "";
  renderBuildSuggestions();
  renderBuild();
}

function runBuild() {
  const b = state.build;
  b.result = buildSchedules(state.allSections, b.courses, {
    earliest: b.prefs.earliest,
    latest: b.prefs.latest,
    daysOff: b.prefs.daysOff,
    sortBy: b.prefs.sortBy,
    busy: state.busy.filter((x) => !x.draft),
    keep: b.prefs.keepPlan ? schedule().filter((s) => !b.courses.includes(courseKey(s))) : [],
  });
  b.previewIndex = b.result.schedules.length ? 0 : null;
  renderBuildResults();
  renderWeek();
  if (window.matchMedia("(max-width: 899px)").matches && b.result.schedules.length) setMobileView("week");
}

function miniWeek(sections) {
  const W = 25, H = 40, top = 8 * 60, span = 13 * 60;
  const rects = sections.flatMap((s) => s.dayList.filter((d) => WEEKDAYS.includes(d)).map((d) => {
    const x = WEEKDAYS.indexOf(d) * W + 2;
    const y = Math.max(0, ((s.startMin - top) / span) * H);
    const h = Math.max(2, ((s.endMin - s.startMin) / span) * H);
    return `<rect class="${colorClass(s.subject)}" x="${x}" y="${y.toFixed(1)}" width="${W - 4}" height="${h.toFixed(1)}" rx="1.5"/>`;
  })).join("");
  return `<svg class="mini" viewBox="0 0 ${W * 5} ${H}" aria-hidden="true">${WEEKDAYS.map((_, i) => `<rect class="mini-col" x="${i * W + 1}" y="0" width="${W - 2}" height="${H}" rx="2"/>`).join("")}${rects}</svg>`;
}

function renderBuildResults() {
  const b = state.build;
  const box = $("#b-results");
  if (!b.result) { box.innerHTML = ""; return; }
  const r = b.result;
  if (!r.schedules.length) {
    let why = "Every combination has at least one overlap. Drop a course, allow more days, or move a busy time.";
    if (r.missing.length) why = `${r.missing.join(", ")} ${r.missing.length === 1 ? "isn't" : "aren't"} offered in this term's data.`;
    else if (r.blocked.length) why = `No section of ${r.blocked.join(" or ")} fits your time and day limits. Try loosening "No classes before", "No classes after", or your days off.`;
    box.innerHTML = `<div class="b-none"><p class="empty-title">No schedule fits</p><p>${esc(why)}</p></div>`;
    return;
  }
  const shown = r.schedules.slice(0, 20);
  box.innerHTML = `
    <p class="b-summary">${r.truncated ? `More than ${MAX_RESULTS}` : r.schedules.length} ${r.schedules.length === 1 ? "schedule fits" : "schedules fit"}.
      ${r.schedules.length > shown.length ? `Showing the best ${shown.length}.` : ""}</p>
    <ol class="b-list">${shown.map((o, i) => {
      const st = o.stats;
      return `<li><button type="button" class="b-option" data-action="b-preview" data-index="${i}" aria-pressed="${b.previewIndex === i}">
        ${miniWeek(b.prefs.keepPlan ? [...schedule(), ...o.sections] : o.sections)}
        <span class="b-option-text">
          <strong>Option ${i + 1}</strong>
          <span>${st.days.length} ${st.days.length === 1 ? "day" : "days"} on campus (${st.days.join(" ")}), first class ${formatTime(st.earliest)}, ${formatDuration(st.gapMinutes)} of gaps</span>
          <span class="muted">${o.sections.map((s) => `${esc(code(s))} sec ${esc(s.sectionLabel)}`).join(", ")}</span>
        </span></button></li>`;
    }).join("")}</ol>`;
}

function previewOption(i) {
  state.build.previewIndex = i;
  state.selectedId = null;
  $("#popover").hidden = true;
  renderBuildResults();
  renderWeek();
}

function exitPreview(render = true) {
  state.build.previewIndex = null;
  if (render) { renderBuildResults(); renderWeek(); }
}

function applyPreview() {
  const b = state.build;
  const opt = b.result?.schedules[b.previewIndex];
  if (!opt) return;
  remember("apply");
  const keep = b.prefs.keepPlan ? schedule().filter((s) => !b.courses.includes(courseKey(s))) : [];
  plan().sections = [...keep, ...opt.sections];
  state.animateIds = new Set(opt.sections.map((s) => s.id));
  const n = b.previewIndex + 1;
  b.previewIndex = null;
  renderBuildResults();
  planChanged();
  toast(`${plan().name} now uses option ${n}.`, true);
}

/* ======================= Plans ======================= */

function switchPlan(i) {
  state.plans.active = i;
  state.selectedId = null;
  state.ghost = null;
  $("#popover").hidden = true;
  exitPreview(false);
  planChanged();
}

function addPlan() {
  if (state.plans.plans.length >= store.MAX_PLANS) return;
  state.plans.plans.push({ name: store.nextPlanName(state.plans), sections: [] });
  switchPlan(state.plans.plans.length - 1);
  toast(`Started ${plan().name}. Your other plans are still saved.`);
}

function deletePlan() {
  if (state.plans.plans.length < 2) return;
  remember("delete-plan");
  const gone = plan().name;
  state.plans.plans.splice(state.plans.active, 1);
  state.plans.active = Math.max(0, state.plans.active - 1);
  planChanged();
  toast(`Deleted ${gone}.`, true);
}

function clearPlan() {
  remember("clear");
  plan().sections = [];
  state.selectedId = null;
  planChanged();
  toast(`Cleared ${plan().name}.`, true);
}

/* ======================= Export and share ======================= */

function openExport() {
  const dlg = $("#export-dialog");
  $("#ics-download").hidden = PREVIEW_BUILD;
  $("#ics-preview-note").hidden = !PREVIEW_BUILD;
  updateExport();
  dlg.showModal();
}

function updateExport() {
  const a = $("#term-start").value;
  const b = $("#term-end").value;
  const ok = a && b && a <= b;
  $("#ics-download").disabled = !ok;
  $("#ics-copy").disabled = !ok;
  $("#ics-error").hidden = !(a && b && a > b);
}

function icsText() {
  return buildICS(schedule(), $("#term-start").value, $("#term-end").value);
}

function downloadICS() {
  const blob = new Blob([icsText()], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const name = `ezclass-${state.term}-${plan().name.toLowerCase().replace(/\s+/g, "-")}.ics`;
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(`Saved ${name}. Open it to add your classes to your calendar app.`);
}

async function copyText(text, okMsg, fallbackEl) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg);
  } catch {
    if (fallbackEl) {
      fallbackEl.hidden = false;
      fallbackEl.value = text;
      fallbackEl.focus();
      fallbackEl.select();
      toast("Your browser blocked copying. The text is selected, so press Ctrl+C or Cmd+C.");
    }
  }
}

function shareLink() {
  const hash = store.shareHash(state.term, schedule());
  const url = `${location.href.split("#")[0]}${hash}`;
  copyText(url, `Copied a link to ${plan().name}. Anyone who opens it sees these classes.`, $("#share-fallback"));
}

async function loadSharedPlan() {
  const shared = store.fromHash();
  if (!shared) return;
  if (shared.term !== state.term) await switchTerm(shared.term, { quiet: true });
  const ids = shared.ids;
  const found = ids.map((id) => state.allSections.find((s) => s.id === id)).filter(Boolean);
  if (!found.length) return;
  const ps = state.plans;
  let target = ps.active;
  if (schedule().length) {
    if (ps.plans.length < store.MAX_PLANS) {
      ps.plans.push({ name: store.nextPlanName(ps), sections: [] });
      target = ps.plans.length - 1;
    } else {
      target = ps.plans.length - 1;
    }
  }
  ps.active = target;
  plan().sections = found;
  store.savePlans(state.term, ps);
  history.replaceState(null, "", location.pathname + location.search);
  toast(`Loaded a shared ${termLabel()} schedule into ${plan().name}.`);
}

/* ======================= Terms ======================= */

const termLabel = () => store.termById(state.term).label;

function renderTerm() {
  const t = store.termById(state.term);
  $("#term-switch").innerHTML = store.TERMS.map((x) =>
    `<button type="button" role="radio" class="term-btn" data-term="${x.id}" aria-checked="${x.id === state.term}">${esc(x.label)}</button>`).join("");
  $("#planner-title").textContent = `Plan your ${t.label} schedule`;
  $("#term-note").textContent = t.note || "";
  $("#term-note").hidden = !t.note;
}

async function loadTermData() {
  const label = termLabel();
  try { state.subjects = await api.fetchSubjects(label); } catch { state.subjects = []; }
  try { state.allSections = await api.fetchSections({ term: label }); } catch { state.allSections = []; }
}

async function switchTerm(id, { quiet = false } = {}) {
  if (id === state.term) return;
  store.savePlans(state.term, state.plans);
  state.term = id;
  store.saveTerm(id);
  state.plans = store.loadPlans(id);
  state.busy = store.loadBusy(id);
  state.selectedBusy = null;
  state.ghost = null;
  state.selectedId = null;
  state.checkResult = null;
  state.undo = null;
  state.animateIds = new Set();
  // Course lists differ by term, so start auto-build fresh.
  state.build.courses = [];
  state.build.result = null;
  state.build.previewIndex = null;
  // Keep subject picks that still exist in the new term.
  $("#popover").hidden = true;
  renderTerm();
  $("#results").setAttribute("aria-busy", "true");
  await loadTermData();
  for (const subj of [...state.filters.picked]) if (!state.subjects.includes(subj)) state.filters.picked.delete(subj);
  renderFilters();
  await refreshSections();
  renderWeek();
  renderBuild();
  if (!quiet) toast(`Now planning ${termLabel()}. Your other terms are saved.`);
}

/* ======================= Toast, theme, mobile ======================= */

let toastTimer;
function toast(msg, withUndo = false) {
  const t = $("#toast");
  t.innerHTML = `<span>${esc(msg)}</span>${withUndo && state.undo ? `<button type="button" class="toast-undo" data-action="undo">Undo</button>` : ""}`;
  t.hidden = false;
  t.classList.remove("show");
  void t.offsetWidth;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove("show"); setTimeout(() => { t.hidden = true; }, 250); }, withUndo ? 6000 : 3200);
}

function effectiveTheme() {
  const set = document.documentElement.dataset.theme;
  if (set) return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function syncThemeButton() {
  const dark = effectiveTheme() === "dark";
  $("#theme-btn").setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  $("#theme-btn").dataset.mode = dark ? "dark" : "light";
}

function toggleTheme() {
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  store.saveTheme(next);
  syncThemeButton();
}

function setMobileView(v) {
  state.mobileView = v;
  $("#planner").dataset.view = v;
  syncBottomNav();
}

function syncBottomNav() {
  const v = state.mobileView;
  const current = v === "week" ? "week" : state.finderTab === "build" ? "build" : "find";
  for (const b of $$(".bottom-nav [data-nav]")) {
    if (b.dataset.nav === current) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
}

const isPhone = () => window.matchMedia("(max-width: 899px)").matches;

// The bottom bar. Phones always show it. Wider screens show it as a floating
// dock once the intro has scrolled mostly out of view.
function initDock() {
  const hero = $("#top");
  if (!hero) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const past = currentPage() === "home" && hero.getBoundingClientRect().bottom < window.innerHeight * 0.55;
    document.documentElement.classList.toggle("dock-on", past);
  };
  onPageChange(() => requestAnimationFrame(update));
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
}

// Scrolls to the planner. On phones it also picks which half to show.
function goToPlanner(view) {
  // The phone layout uses this to pick a half; on wider screens it only
  // decides which dock button is highlighted.
  if (view) setMobileView(view);
  goHome();
  const target = view === "week" && !isPhone() ? $("#week") : $("#planner");
  target.scrollIntoView({ block: "start" });
}

// Shows one course in the list, clearing any filter that would hide it.
async function jumpToCourse(key) {
  setFinderTab("browse");
  goToPlanner("find");
  const f = state.filters;
  f.picked.clear(); f.days.clear(); f.upperOnly = false; f.professor = ""; f.keyword = key;
  $("#f-keyword").value = key;
  $("#f-professor").value = "";
  renderFilters();
  await refreshSections();
  const el = $$(".course").find((c) => c.dataset.course === key);
  if (el) {
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
    el.querySelector(".btn-add")?.focus({ preventScroll: true });
  }
}

/* ======================= Getting started ======================= */

function renderGuide(previewing) {
  const box = $("#guide");
  const show = !previewing && !schedule().length;
  box.hidden = !show;
  if (!show) return;
  box.innerHTML = `
    <p class="guide-title">Get a schedule in three steps</p>
    <ol class="guide-steps">
      <li class="done"><span class="guide-mark" aria-hidden="true"></span><div><strong>Pick a term</strong>
        <span>You're planning ${esc(termLabel())}. Switch terms at the top of the planner.</span></div></li>
      <li><span class="guide-mark" aria-hidden="true"></span><div><strong>Add classes</strong>
        <span>Pick sections from the list yourself, or let Auto-build find combinations that fit.</span>
        <span class="guide-btns">
          <button type="button" class="btn btn-quiet btn-sm" data-action="nav-browse">Browse sections</button>
          <button type="button" class="btn btn-quiet btn-sm" data-action="nav-build">Open Auto-build</button>
          <button type="button" class="btn btn-red btn-sm" data-action="example">Show me an example</button>
        </span></div></li>
      <li><span class="guide-mark" aria-hidden="true"></span><div><strong>Check for conflicts</strong>
        <span>With two or more classes added, one click asks the server whether anything overlaps.</span></div></li>
    </ol>`;
}

// Fills Auto-build with three common courses and shows the results,
// so a first-time visitor sees what the planner does in one click.
function runExample() {
  const have = new Set(allCourseOptions().map((o) => o.key));
  const picks = ["CS 310", "MATH 254", "RWS 280", "CS 210", "MATH 245", "PSY 101", "HIST 109"].filter((k) => have.has(k)).slice(0, 3);
  if (!picks.length) return;
  state.build.courses = picks;
  state.build.result = null;
  setFinderTab("build");
  runBuild();
  goToPlanner(isPhone() ? "find" : undefined);
  const n = state.build.result?.schedules.length || 0;
  const list = picks.length > 1 ? `${picks.slice(0, -1).join(", ")} and ${picks.at(-1)}` : picks[0];
  toast(n
    ? `Found ${n} ${n === 1 ? "schedule" : "schedules"} for ${list}. The best one is on your week now. Use Next to see the others.`
    : `No schedule fits ${list} right now. Try removing a busy time.`);
}

/* ======================= Command palette ======================= */

let palette;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function paletteItems(q) {
  const out = [];
  const add = (group, item, hay, limitScore = 0) => {
    const sc = score(q, hay);
    if (sc > limitScore) out.push({ ...item, group, sc });
  };

  if (q) {
    for (const o of allCourseOptions()) {
      add("Courses", {
        badge: o.key, badgeClass: colorClass(o.subject), label: o.title,
        meta: `${o.count} ${o.count === 1 ? "section" : "sections"} in ${termLabel()}`,
        run: () => state.finderTab === "build" ? (goToPlanner("find"), addBuildCourse(o.key)) : jumpToCourse(o.key),
      }, `${o.key} ${o.title}`);
    }
    for (const s of state.allSections) {
      const added = inPlan(s.id);
      add("Sections", {
        badge: code(s), badgeClass: colorClass(s.subject),
        label: `${added ? "Remove" : "Add"} section ${s.sectionLabel}`,
        meta: `${s.days || "Online"} ${formatRange(s)}, ${s.professor}`.trim(),
        run: () => added ? removeSection(s.id) : addSection(s),
      }, `${added ? "remove" : "add"} ${code(s)} ${s.title} section ${s.sectionLabel} ${s.professor} ${s.days}`);
    }
  }

  const A = (label, run, hay = "", extra = {}) => add("Go to and do", { label, run, ...extra }, `${label} ${hay}`);
  const t = store.termById(state.term);
  A("Browse sections", () => { setFinderTab("browse"); goToPlanner("find"); }, "list find classes search", { hint: "B" });
  A("Auto-build a schedule", () => { setFinderTab("build"); goToPlanner("find"); setTimeout(() => $("#b-input").focus(), 50); }, "generate combinations", { hint: "A" });
  A(`Show my week (${plan().name})`, () => goToPlanner("week"), "calendar grid schedule");
  for (const x of store.TERMS) if (x.id !== t.id) A(`Switch to ${x.label}`, () => { switchTerm(x.id); goToPlanner(); }, "term semester");
  state.plans.plans.forEach((p, i) => { if (i !== state.plans.active) A(`Open ${p.name}`, () => { switchPlan(i); goToPlanner("week"); }, "plan", { hint: String(i + 1) }); });
  if (state.plans.plans.length < store.MAX_PLANS) A("Start a new plan", () => { addPlan(); goToPlanner("week"); }, "plan");
  if (schedule().length >= 2) A("Check for conflicts", () => { goToPlanner("week"); runCheck(); }, "overlap clash");
  if (schedule().length) {
    A("Add this plan to my calendar", () => { goToPlanner("week"); openExport(); }, "export ics google apple outlook");
    A("Copy a share link", shareLink, "send friend");
  }
  A("Show me an example schedule", runExample, "demo sample try");
  A("Block out a busy time", () => { goToPlanner("week"); setTimeout(addBusyFromButton, 80); }, "work job practice commute busy");
  if (state.plans.plans.length > 1) A("Compare plans", () => openCompare(), "side by side");
  if (activeFilterCount()) A("Clear all filters", () => { resetFilters(); goToPlanner("find"); }, "reset");
  A(`Switch to ${effectiveTheme() === "dark" ? "light" : "dark"} theme`, toggleTheme, "mode night");
  A("Keyboard shortcuts", openKeys, "help keys", { hint: "?" });
  const go = (hash) => () => { location.hash = hash; };
  A("Features", go("#how"), "help how it works product");
  A("About us", go("#/about"), "company story mission acronym");
  A("Meet the team", go("#/team"), "people who built");
  A("Blog", go("#/blog"), "news posts updates");
  A("Deliverables", go("#/deliverables"), "roadmap phases milestones");
  A("Privacy", go("#/privacy"), "data policy");
  A("Terms of use", go("#/terms"), "legal");
  if (q) for (const p of POSTS) A(`Read: ${p.title}`, go(`#/blog/${p.slug}`), `blog post ${p.tag}`);
  A("Back to the top", () => { location.hash = "#/"; window.scrollTo({ top: 0 }); }, "home hero");

  const groupOrder = q ? ["Courses", "Sections", "Go to and do"] : ["Go to and do"];
  const caps = { Courses: 5, Sections: 6, "Go to and do": q ? 6 : 20 };
  return groupOrder.flatMap((g) => out.filter((i) => i.group === g).sort((a, b) => (q ? b.sc - a.sc : 0)).slice(0, caps[g]));
}

function openPalette(prefill = "") {
  palette.open(prefill);
}

function openKeys() {
  $("#keys-dialog").showModal();
}

// On the home page, "Product" lights up near the top and "Planner" while the
// planner is on screen.
function initScrollSpy() {
  const links = $$(".topnav [data-spy]");
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    if (currentPage() !== "home") return;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const spot = e.target.id === "planner" ? "planner" : "top";
      for (const a of links) {
        if (a.dataset.spy === spot) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      }
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  for (const id of ["top", "what", "how", "steps", "planner"]) if ($(`#${id}`)) io.observe($(`#${id}`));
}

// The slide-in menu on phones.
function initMenu() {
  const sheet = $("#menu-sheet");
  if (!sheet) return;
  $("#menu-btn").addEventListener("click", () => sheet.showModal());
  $("#menu-close").addEventListener("click", () => sheet.close());
  $("#menu-theme").addEventListener("click", () => $("#theme-btn").click());
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet || e.target.closest("a")) sheet.close();
  });
}

function setFinderTab(tab) {
  state.finderTab = tab;
  for (const t of $$("[data-ftab]")) {
    const on = t.dataset.ftab === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
  }
  $("#browse-panel").hidden = tab !== "browse";
  $("#build-panel").hidden = tab !== "build";
  if (tab === "build") renderBuild();
  if (tab === "browse") exitPreview();
  syncBottomNav();
}

function openFilters(open) {
  $("#planner").classList.toggle("filters-open", open);
  $("#filters-toggle").setAttribute("aria-expanded", String(open));
  if (open) $("#f-keyword").focus({ preventScroll: true });
}

/* ======================= Events ======================= */

function wire() {
  // filters
  const onText = debounce(() => {
    state.filters.keyword = $("#f-keyword").value.trim();
    state.filters.professor = $("#f-professor").value.trim();
    renderFilters();
    refreshSections();
  }, 220);
  $("#f-keyword").addEventListener("input", onText);
  $("#f-professor").addEventListener("input", onText);
  $("#f-upper").addEventListener("change", (e) => { state.filters.upperOnly = e.target.checked; renderFilters(); renderResults(); });
  $("#sort").addEventListener("change", (e) => { state.filters.sort = e.target.value; renderResults(); });
  $("#filters-toggle").addEventListener("click", () => openFilters(!$("#planner").classList.contains("filters-open")));
  $("#filters-done").addEventListener("click", () => openFilters(false));
  $("#filters-backdrop").addEventListener("click", () => openFilters(false));

  // one click handler for the whole page
  document.addEventListener("click", (e) => {
    if (Date.now() - lastDragEnd < 400 && e.target.closest("#calendar")) return;
    const t = e.target.closest("[data-action], [data-term], [data-subject], [data-day], [data-plan], [data-ftab], [data-mview], .blk, .busy:not(.draft)");
    if (!t) {
      if (!e.target.closest("#popover")) closePopover();
      return;
    }
    if (t.matches(".blk")) { openPopover(t.dataset.id, t); return; }
    if (t.matches(".busy")) { openBusyEditor(t.dataset.busy, t); return; }
    if (t.dataset.term) { switchTerm(t.dataset.term); return; }
    if (t.dataset.subject) {
      const f = state.filters.picked;
      f.has(t.dataset.subject) ? f.delete(t.dataset.subject) : f.add(t.dataset.subject);
      renderFilters(); refreshSections(); return;
    }
    if (t.dataset.day) {
      const set = t.dataset.kind === "off" ? state.build.prefs.daysOff : state.filters.days;
      set.has(t.dataset.day) ? set.delete(t.dataset.day) : set.add(t.dataset.day);
      t.setAttribute("aria-pressed", String(set.has(t.dataset.day)));
      if (t.dataset.kind === "off") { state.build.result = null; exitPreview(); renderBuild(); } else { renderFilters(); renderResults(); }
      return;
    }
    if (t.dataset.plan) { switchPlan(Number(t.dataset.plan)); return; }
    if (t.dataset.ftab) { setFinderTab(t.dataset.ftab); return; }
    if (t.dataset.mview) {
      if (t.dataset.mview === "find" && t.closest(".bottom-nav")) setFinderTab("browse");
      setMobileView(t.dataset.mview);
      goToPlanner(t.dataset.mview);
      return;
    }

    const id = t.dataset.id;
    switch (t.dataset.action) {
      case "toggle": inPlan(id) ? removeSection(id) : addSection(state.sections.find((s) => s.id === id)); break;
      case "remove": removeSection(id); $("#popover").hidden = true; break;
      case "close-pop": closePopover(); break;
      case "reset": resetFilters(); break;
      case "palette": openPalette(); break;
      case "example": runExample(); break;
      case "edit-busy": openBusyEditor(t.dataset.busyId, t); break;
      case "nav-browse": setFinderTab("browse"); goToPlanner("find"); break;
      case "nav-build": setFinderTab("build"); goToPlanner("find"); setTimeout(() => $("#b-input").focus({ preventScroll: true }), 60); break;
      case "undo": undo(); break;
      case "add-plan": addPlan(); break;
      case "b-remove":
        state.build.courses = state.build.courses.filter((k) => k !== t.dataset.course);
        state.build.result = null; exitPreview(); renderBuild(); break;
      case "b-preview": previewOption(Number(t.dataset.index)); break;
    }
  });

  // hovering or focusing a section previews it on the grid
  const results = $("#results");
  const setGhost = (s) => {
    if (state.ghost?.id === s?.id) return;
    state.ghost = s && !inPlan(s.id) ? s : null;
    renderWeek();
  };
  results.addEventListener("pointerover", (e) => {
    const li = e.target.closest(".sec");
    if (li && e.pointerType !== "touch") setGhost(state.sections.find((s) => s.id === li.dataset.id));
  });
  results.addEventListener("pointerleave", () => setGhost(null));
  results.addEventListener("focusin", (e) => {
    const li = e.target.closest(".sec");
    if (li) setGhost(state.sections.find((s) => s.id === li.dataset.id));
  });
  results.addEventListener("focusout", (e) => { if (!results.contains(e.relatedTarget)) setGhost(null); });

  // week actions
  $("#check-btn").addEventListener("click", runCheck);
  $("#clear-btn").addEventListener("click", clearPlan);
  $("#delete-plan-btn").addEventListener("click", deletePlan);
  $("#export-btn").addEventListener("click", openExport);
  $("#share-btn").addEventListener("click", shareLink);
  $("#preview-prev").addEventListener("click", () => previewOption(Math.max(0, state.build.previewIndex - 1)));
  $("#preview-next").addEventListener("click", () => previewOption(Math.min(state.build.result.schedules.length - 1, state.build.previewIndex + 1)));
  $("#preview-apply").addEventListener("click", applyPreview);
  $("#preview-cancel").addEventListener("click", () => exitPreview());

  // export dialog
  $("#term-start").addEventListener("input", updateExport);
  $("#term-end").addEventListener("input", updateExport);
  $("#ics-download").addEventListener("click", () => { downloadICS(); $("#export-dialog").close(); });
  $("#ics-copy").addEventListener("click", () => copyText(icsText(), "Copied the calendar file. Paste it into a new file named schedule.ics.", $("#ics-text")));
  $("#export-close").addEventListener("click", () => $("#export-dialog").close());

  // auto-build
  const input = $("#b-input");
  input.addEventListener("input", renderBuildSuggestions);
  input.addEventListener("keydown", (e) => {
    const opts = $$("#b-suggest li");
    let i = opts.findIndex((o) => o.getAttribute("aria-selected") === "true");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!opts.length) return;
      i = (i + (e.key === "ArrowDown" ? 1 : opts.length - 1)) % opts.length;
      opts.forEach((o, j) => o.setAttribute("aria-selected", String(j === i)));
      input.setAttribute("aria-activedescendant", opts[i].id);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (opts[i]) addBuildCourse(opts[i].dataset.course);
    } else if (e.key === "Escape") {
      $("#b-suggest").hidden = true;
    }
  });
  $("#b-suggest").addEventListener("mousedown", (e) => {
    const li = e.target.closest("li");
    if (li) { e.preventDefault(); addBuildCourse(li.dataset.course); }
  });
  input.addEventListener("blur", () => setTimeout(() => { $("#b-suggest").hidden = true; }, 120));
  $("#b-earliest").addEventListener("change", (e) => { state.build.prefs.earliest = e.target.value ? Number(e.target.value) : null; state.build.result = null; exitPreview(); renderBuild(); });
  $("#b-latest").addEventListener("change", (e) => { state.build.prefs.latest = e.target.value ? Number(e.target.value) : null; state.build.result = null; exitPreview(); renderBuild(); });
  $("#b-keep").addEventListener("change", (e) => { state.build.prefs.keepPlan = e.target.checked; state.build.result = null; exitPreview(); renderBuild(); });
  for (const r of $$("input[name=b-sort]")) r.addEventListener("change", (e) => { state.build.prefs.sortBy = e.target.value; if (state.build.result) runBuild(); });
  $("#b-run").addEventListener("click", runBuild);

  // theme
  $("#theme-btn").addEventListener("click", toggleTheme);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", syncThemeButton);

  // keyboard
  document.addEventListener("keydown", (e) => {
    const typing = e.target.closest("input, textarea, select, [contenteditable]");
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      palette.isOpen() ? palette.close() : openPalette();
      return;
    }
    const dialogOpen = $$("dialog").some((d) => d.open);
    if (!typing && !dialogOpen && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.key === "?") { e.preventDefault(); openKeys(); return; }
      if (e.key === "a") { setFinderTab("build"); goToPlanner("find"); return; }
      if (e.key === "b") { setFinderTab("browse"); goToPlanner("find"); return; }
      if (e.key === "t") {
        const i = store.TERMS.findIndex((x) => x.id === state.term);
        switchTerm(store.TERMS[(i + 1) % store.TERMS.length].id);
        return;
      }
      if (["1", "2", "3"].includes(e.key) && state.plans.plans[Number(e.key) - 1]) { switchPlan(Number(e.key) - 1); return; }
    }
    if (e.key === "/" && !typing) {
      e.preventDefault();
      setFinderTab("browse");
      if (window.matchMedia("(max-width: 1179px)").matches) openFilters(true);
      $("#f-keyword").focus();
    }
    if (e.key === "Escape") {
      if (!$("#popover").hidden) closePopover();
      else if ($("#planner").classList.contains("filters-open")) openFilters(false);
      else if (state.build.previewIndex != null) exitPreview();
    }
  });

  $("#keys-close").addEventListener("click", () => $("#keys-dialog").close());
  $("#busy-btn").addEventListener("click", addBusyFromButton);
  $("#compare-btn").addEventListener("click", openCompare);
  $("#compare-close").addEventListener("click", () => $("#compare-dialog").close());
  $("#compare-dialog").addEventListener("click", (e) => {
    if (e.target.id === "compare-dialog") e.target.close();
    const b = e.target.closest("[data-compare-open]");
    if (b) { $("#compare-dialog").close(); switchPlan(Number(b.dataset.compareOpen)); goToPlanner("week"); }
  });
  wireBusyDrag();
  $("#keys-dialog").addEventListener("click", (e) => { if (e.target.id === "keys-dialog") e.target.close(); });

  // finder tabs: arrow keys
  const ftabs = $$("[data-ftab]");
  ftabs.forEach((t, i) => t.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const n = ftabs[(i + (e.key === "ArrowRight" ? 1 : ftabs.length - 1)) % ftabs.length];
    setFinderTab(n.dataset.ftab);
    n.focus();
  }));
}

/* ======================= Start ======================= */

async function init() {
  palette = createPalette({ dialog: $("#palette"), input: $("#pal-input"), list: $("#pal-list"), getItems: paletteItems });
  for (const k of $$(".mod-key")) k.textContent = isMac ? "⌘" : "Ctrl";
  renderTerm();
  initRouter();
  initMenu();
  initHero();
  initScrollSpy();
  initDrawOnScroll();
  initDock();
  syncThemeButton();
  wire();
  renderFilters();
  renderWeek();

  await api.connect();
  if (api.usingSampleData()) {
    const s = $("#data-status");
    s.hidden = false;
    s.textContent = "Sample data";
    s.title = PREVIEW_BUILD
      ? "This preview uses made-up sections, not real SDSU classes."
      : "The server didn't answer at /api/health, so the page is using made-up sections.";
  }

  const sharedLink = Boolean(store.fromHash());
  await loadTermData();
  await loadSharedPlan();
  renderFilters();
  await refreshSections();
  renderWeek();
  renderBuild();
  syncBottomNav();

  // Opening a share link jumps straight to the planner. Returning visitors
  // on the home page get a reminder that their plan is saved.
  if (sharedLink) {
    const html = document.documentElement;
    const before = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    $("#planner").scrollIntoView({ block: "start" });
    html.style.scrollBehavior = before;
  } else if (schedule().length && currentPage() === "home") {
    toast(`Welcome back. ${plan().name} for ${termLabel()} is saved in the planner.`);
  }
}

state.allSections = [];
state.plans = store.loadPlans(state.term);
state.busy = store.loadBusy(state.term);
init();

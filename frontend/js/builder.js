// Auto-build: given the courses a student needs, find every combination of
// sections that fits, then rank them by what the student prefers.
// Pure functions, no DOM, so this file is easy to test on its own.

import { sectionsOverlap } from "./time.js";
import { weekStats } from "./stats.js";

export const MAX_RESULTS = 500;

export const courseKey = (s) => `${s.subject} ${s.catalog}`;

// prefs: { earliest, latest: minutes or null, daysOff: Set of day codes, sortBy, keep: sections, busy: busy times }
export function sectionAllowed(s, prefs) {
  if (!Number.isFinite(s.startMin) || !s.dayList.length) return true; // online or TBA
  if (prefs.earliest != null && s.startMin < prefs.earliest) return false;
  if (prefs.latest != null && s.endMin > prefs.latest) return false;
  if (prefs.daysOff?.size && s.dayList.some((d) => prefs.daysOff.has(d))) return false;
  return true;
}

export function buildSchedules(allSections, courses, prefs) {
  const options = courses.map((c) => ({
    course: c,
    all: allSections.filter((s) => courseKey(s) === c),
  }));
  for (const o of options) o.ok = o.all.filter((s) => sectionAllowed(s, prefs));

  // Explain the failure if any course has nothing left after the time and day rules.
  const blocked = options.filter((o) => o.all.length && !o.ok.length).map((o) => o.course);
  const missing = options.filter((o) => !o.all.length).map((o) => o.course);
  if (blocked.length || missing.length) {
    return { schedules: [], blocked, missing, truncated: false };
  }

  // Courses with the fewest choices first keeps the search small.
  options.sort((a, b) => a.ok.length - b.ok.length);

  const keep = prefs.keep || [];
  const busy = prefs.busy || []; // blocked-out times, never scheduled over
  const results = [];
  let truncated = false;
  const chosen = [];

  (function walk(i) {
    if (results.length >= MAX_RESULTS) { truncated = true; return; }
    if (i === options.length) { results.push([...chosen]); return; }
    for (const s of options[i].ok) {
      if (chosen.some((c) => sectionsOverlap(c, s))) continue;
      if (keep.some((k) => sectionsOverlap(k, s))) continue;
      if (busy.some((b) => sectionsOverlap(b, s))) continue;
      chosen.push(s);
      walk(i + 1);
      chosen.pop();
      if (truncated) return;
    }
  })(0);

  const scored = results.map((sections) => ({ sections, stats: weekStats([...keep, ...sections]) }));
  scored.sort(comparator(prefs.sortBy));
  return { schedules: scored, blocked: [], missing: [], truncated };
}

function comparator(sortBy) {
  const byDays = (a, b) => a.stats.days.length - b.stats.days.length;
  const byGaps = (a, b) => a.stats.gapMinutes - b.stats.gapMinutes;
  const byLate = (a, b) => (b.stats.earliest ?? 0) - (a.stats.earliest ?? 0);
  const order = {
    days: [byDays, byGaps, byLate],
    gaps: [byGaps, byDays, byLate],
    late: [byLate, byDays, byGaps],
  }[sortBy] || [byDays, byGaps, byLate];
  return (a, b) => {
    for (const f of order) {
      const r = f(a, b);
      if (r) return r;
    }
    return 0;
  };
}

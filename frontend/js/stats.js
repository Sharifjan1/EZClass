// Numbers about a week of classes: units, hours, days on campus, gaps, and
// "tight walks" (back-to-back classes in different buildings).
// Used by the stats strip under the calendar and to rank auto-built schedules.

import { DAY_ORDER } from "./time.js";

export const TIGHT_WALK_MIN = 15;
const building = (s) => {
  const b = String(s.room || "").trim().split(/\s+/)[0].toUpperCase();
  return b && b !== "TBA" && b !== "ONLINE" ? b : "";
};

export function weekStats(sections) {
  const timed = sections.filter((s) => Number.isFinite(s.startMin) && Number.isFinite(s.endMin));
  const units = sections.reduce((n, s) => n + (s.units || 0), 0);

  const byDay = new Map();
  for (const s of timed) {
    for (const d of s.dayList) {
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(s);
    }
  }

  let minutesInClass = 0;
  let gapMinutes = 0;
  let longestGap = 0;
  let earliest = Infinity;
  let latest = -Infinity;

  const tightWalks = [];
  for (const [day, list] of byDay) {
    list.sort((a, b) => a.startMin - b.startMin);
    let lastEnd = null;
    let prev = null;
    for (const s of list) {
      if (prev && s.startMin >= prev.endMin && s.startMin - prev.endMin <= TIGHT_WALK_MIN) {
        const from = building(prev), to = building(s);
        if (from && to && from !== to) {
          // The same pair on Mon and Wed counts once, with both days listed.
          const same = tightWalks.find((w) => w.from.id === prev.id && w.to.id === s.id);
          if (same) same.days.push(day);
          else tightWalks.push({ days: [day], from: prev, to: s, gap: s.startMin - prev.endMin });
        }
      }
      if (!prev || s.endMin > prev.endMin) prev = s;
      minutesInClass += s.endMin - s.startMin;
      earliest = Math.min(earliest, s.startMin);
      latest = Math.max(latest, s.endMin);
      if (lastEnd !== null && s.startMin > lastEnd) {
        const gap = s.startMin - lastEnd;
        gapMinutes += gap;
        longestGap = Math.max(longestGap, gap);
      }
      lastEnd = lastEnd === null ? s.endMin : Math.max(lastEnd, s.endMin);
    }
  }

  for (const w of tightWalks) w.days.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));

  return {
    classes: sections.length,
    units,
    hoursInClass: minutesInClass / 60,
    days: DAY_ORDER.filter((d) => byDay.has(d)),
    earliest: Number.isFinite(earliest) ? earliest : null,
    latest: Number.isFinite(latest) ? latest : null,
    gapMinutes,
    longestGap,
    tightWalks,
  };
}

export function formatDuration(mins) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

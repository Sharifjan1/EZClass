// Day and time helpers. These mirror the backend rules in
// backend/models/conflicts.py so the page can warn about overlaps
// before the student clicks "Check for conflicts". The server is still
// the final word: the Check button always asks the API.

export const DAY_ORDER = ["M", "T", "W", "Th", "F", "Sa", "Su"];

export const DAY_NAMES = {
  M: "Monday", T: "Tuesday", W: "Wednesday", Th: "Thursday",
  F: "Friday", Sa: "Saturday", Su: "Sunday",
};

// Turns a pattern like "MWF", "TTh", or "TR" into ["M","W","F"] etc.
// Two-letter tokens are read first so "TTh" is Tue + Thu, not Tue + Tue + h.
// "R" is treated as Thursday because some rows in the data use "TR".
export function parseDays(pattern) {
  const days = new Set();
  const s = String(pattern || "").trim();
  let i = 0;
  while (i < s.length) {
    const two = s.slice(i, i + 2);
    if (two === "Th" || two === "TH") { days.add("Th"); i += 2; continue; }
    if (two === "Sa" || two === "SA") { days.add("Sa"); i += 2; continue; }
    if (two === "Su" || two === "SU") { days.add("Su"); i += 2; continue; }
    if (two === "Tu" || two === "TU") { days.add("T"); i += 2; continue; }
    const one = s[i].toUpperCase();
    if (one === "M") days.add("M");
    else if (one === "T") days.add("T");
    else if (one === "W") days.add("W");
    else if (one === "R") days.add("Th");
    else if (one === "F") days.add("F");
    else if (one === "S") days.add("Sa");
    i += 1;
  }
  return DAY_ORDER.filter((d) => days.has(d));
}

// "10:00", "10:00:00", "1000", "9:5" -> minutes after midnight. Returns NaN if unreadable.
export function toMinutes(t) {
  const s = String(t ?? "").trim();
  let m = s.match(/^(\d{1,2}):(\d{1,2})/);
  if (!m) m = s.match(/^(\d{1,2})(\d{2})$/);
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  let total = h * 60 + min;
  if (/pm/i.test(s) && h < 12) total += 12 * 60;
  if (/am/i.test(s) && h === 12) total -= 12 * 60;
  return total;
}

export function formatTime(mins) {
  if (!Number.isFinite(mins)) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

// "10–11:15am" when both ends share am/pm, for tight spaces like the calendar.
export function formatRangeShort(section) {
  const a = formatTime(section.startMin);
  const b = formatTime(section.endMin);
  if (!a || !b) return "";
  const sameHalf = (section.startMin < 720) === (section.endMin < 720);
  return `${sameHalf ? a.replace(/am|pm/, "") : a}–${b}`;
}

export function formatRange(section) {
  if (!Number.isFinite(section.startMin) || !Number.isFinite(section.endMin)) return "";
  return `${formatTime(section.startMin)}–${formatTime(section.endMin)}`;
}

// Two sections clash when they share a day and their times overlap.
// Back-to-back (one ends exactly when the other starts) is fine.
export function sectionsOverlap(a, b) {
  if (a.id === b.id) return false;
  const shared = a.dayList.some((d) => b.dayList.includes(d));
  if (!shared) return false;
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

export function sharedDays(a, b) {
  return a.dayList.filter((d) => b.dayList.includes(d));
}

// Every clashing pair in a list of sections.
export function findConflicts(sections) {
  const pairs = [];
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      if (sectionsOverlap(sections[i], sections[j])) {
        pairs.push([sections[i], sections[j]]);
      }
    }
  }
  return pairs;
}

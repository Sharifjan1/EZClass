// Builds an .ics calendar file so a schedule can go into Google Calendar,
// Apple Calendar, or Outlook as weekly repeating events.

const ICS_DAY = { M: "MO", T: "TU", W: "WE", Th: "TH", F: "FR", Sa: "SA", Su: "SU" };
const JS_DAY = { Su: 0, M: 1, T: 2, W: 3, Th: 4, F: 5, Sa: 6 };

const pad = (n) => String(n).padStart(2, "0");
const stamp = (d, mins) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(Math.floor(mins / 60))}${pad(mins % 60)}00`;
const escapeText = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

// termStart and termEnd are "YYYY-MM-DD" strings from date inputs.
export function buildICS(sections, termStart, termEnd) {
  const [y1, m1, d1] = termStart.split("-").map(Number);
  const [y2, m2, d2] = termEnd.split("-").map(Number);
  const start = new Date(y1, m1 - 1, d1);
  const until = `${y2}${pad(m2)}${pad(d2)}T235959`;
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;

  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EzClass//SDSU Planner//EN", "CALSCALE:GREGORIAN",
  ];

  for (const s of sections) {
    if (!Number.isFinite(s.startMin) || !s.dayList.length) continue;
    // First meeting: the first class day on or after the term start.
    const first = new Date(start);
    const wanted = new Set(s.dayList.map((d) => JS_DAY[d]));
    for (let i = 0; i < 7 && !wanted.has(first.getDay()); i++) first.setDate(first.getDate() + 1);

    lines.push(
      "BEGIN:VEVENT",
      `UID:ezclass-${s.id}-${termStart}@ezclass`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=America/Los_Angeles:${stamp(first, s.startMin)}`,
      `DTEND;TZID=America/Los_Angeles:${stamp(first, s.endMin)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${s.dayList.map((d) => ICS_DAY[d]).join(",")};UNTIL=${until}`,
      `SUMMARY:${escapeText(`${s.subject} ${s.catalog} ${s.title}`)}`,
      `LOCATION:${escapeText(s.room)}`,
      `DESCRIPTION:${escapeText(`Section ${s.sectionLabel} with ${s.professor}`)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

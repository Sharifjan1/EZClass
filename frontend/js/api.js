// Talks to the Flask API. Every response goes through a normalize step,
// so the rest of the page only ever sees one shape of section object.
// If the backend's JSON keys change, this is the only file to update.

import { parseDays, toMinutes } from "./time.js";
import { SAMPLE_SECTIONS } from "./sample-data.js";

const API = "/api";

// Sample mode: add ?sample to the URL, or set window.EZCLASS_SAMPLE = true
// before the script loads (the one-file preview build does this).
let useSample = Boolean(window.EZCLASS_SAMPLE) || new URLSearchParams(location.search).has("sample");

export function usingSampleData() {
  return useSample;
}

// Call once at startup. Switches to sample data if the server is not reachable.
export async function connect() {
  if (useSample) return { ok: false, reason: "sample mode was requested in the URL" };
  try {
    const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`health check returned ${res.status}`);
    return { ok: true };
  } catch (err) {
    useSample = true;
    return { ok: false, reason: err.message };
  }
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

// Accepts the row shapes we have seen or expect from routes/sections.py.
export function normalizeSection(raw) {
  let subject = pick(raw, ["subject", "course_subject"]);
  let catalog = pick(raw, ["catalog_num", "catalog_number", "number", "course_number"]);
  const course = pick(raw, ["course", "course_code"]);
  if ((!subject || !catalog) && typeof course === "string") {
    const m = course.trim().match(/^([A-Za-z&]+)\s*-?\s*(\w+)$/);
    if (m) { subject = subject || m[1]; catalog = catalog || m[2]; }
  }

  let professor = pick(raw, ["professor", "professor_name", "instructor"]);
  if (!professor) {
    const first = pick(raw, ["first_name", "professor_first_name", "prof_first"]) || "";
    const last = pick(raw, ["last_name", "professor_last_name", "prof_last"]) || "";
    professor = `${first} ${last}`.trim();
  }

  let room = pick(raw, ["room", "location"]);
  if (!room) {
    const building = pick(raw, ["building"]) || "";
    const num = pick(raw, ["room_number"]) || "";
    room = `${building} ${num}`.trim();
  }

  // Some routes send a single "time" string like "10:00-11:15".
  let start = pick(raw, ["start_time", "start"]);
  let end = pick(raw, ["end_time", "end"]);
  const time = pick(raw, ["time", "times"]);
  if ((!start || !end) && typeof time === "string" && time.includes("-")) {
    [start, end] = time.split("-").map((s) => s.trim());
  }

  const days = String(pick(raw, ["days", "day_pattern", "meeting_days"]) || "");
  const id = pick(raw, ["section_id", "id"]);

  return {
    id: String(id),
    subject: String(subject || "").toUpperCase(),
    catalog: String(catalog || ""),
    catalogNum: parseInt(catalog, 10),
    title: pick(raw, ["title", "course_title", "name"]) || "",
    sectionLabel: String(pick(raw, ["section_number", "section_num", "section", "sec"]) ?? id),
    professor: professor || "Staff",
    days,
    dayList: parseDays(days),
    startMin: toMinutes(start),
    endMin: toMinutes(end),
    room: room || "TBA",
    units: Number(pick(raw, ["units", "credits"])) || null,
    term: String(pick(raw, ["term", "semester"]) || ""),
  };
}

function listFrom(json, keys) {
  if (Array.isArray(json)) return json;
  for (const k of keys) if (Array.isArray(json?.[k])) return json[k];
  return [];
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

// "Spring 2027", "spring-2027", and "SPRING2027" all count as the same term.
const sameTerm = (a, b) => String(a).toLowerCase().replace(/[^a-z0-9]/g, "") === String(b).toLowerCase().replace(/[^a-z0-9]/g, "");

export async function fetchSubjects(term = "") {
  if (useSample) {
    return [...new Set(SAMPLE_SECTIONS.filter((s) => !term || sameTerm(s.term, term)).map((s) => s.subject))].sort();
  }
  const json = await getJSON(`${API}/subjects${term ? `?term=${encodeURIComponent(term)}` : ""}`);
  return listFrom(json, ["subjects", "data"])
    .map((s) => (typeof s === "string" ? s : pick(s, ["subject", "name", "code"])))
    .filter(Boolean)
    .sort();
}

// Server-side filters: professor and keyword (and subject when exactly one is picked).
// Multi-subject, multi-day, and upper-division filtering happen in app.js.
// term is the label, like "Spring 2027". It's sent as ?term= and also checked
// here, so the page works whether or not the route filters by term yet.
export async function fetchSections({ term = "", subjects = [], professor = "", q = "" } = {}) {
  if (useSample) {
    const p = professor.toLowerCase();
    const k = q.toLowerCase();
    return SAMPLE_SECTIONS.map(normalizeSection).filter((s) => {
      if (term && !sameTerm(s.term, term)) return false;
      if (subjects.length === 1 && s.subject !== subjects[0]) return false;
      if (p && !s.professor.toLowerCase().includes(p)) return false;
      if (k && !`${s.subject} ${s.catalog} ${s.title}`.toLowerCase().includes(k)) return false;
      return true;
    });
  }
  const params = new URLSearchParams();
  if (term) params.set("term", term);
  if (subjects.length === 1) params.set("subject", subjects[0]);
  if (professor) params.set("professor", professor);
  if (q) params.set("q", q);
  const json = await getJSON(`${API}/sections?${params}`);
  return listFrom(json, ["sections", "results", "data"])
    .map(normalizeSection)
    .filter((s) => !term || !s.term || sameTerm(s.term, term));
}

// Asks the server which picked sections clash. Returns [[idA, idB, note], ...].
// The server's reply format is read loosely: pairs can be arrays, objects,
// or strings like "49 conflicts with 50 (MW overlap)".
export async function checkSchedule(ids, localFallback) {
  if (useSample) return localFallback();
  const res = await fetch(`${API}/schedule/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section_ids: ids.map((x) => (/^\d+$/.test(x) ? Number(x) : x)) }),
  });
  if (!res.ok) throw new Error(`Conflict check returned ${res.status}`);
  const json = await res.json();
  const items = listFrom(json, ["conflicts", "pairs", "data", "results"]);
  const known = new Set(ids.map(String));

  return items.map((item) => {
    let found = [];
    let note = "";
    if (typeof item === "string") {
      found = (item.match(/\w+/g) || []).filter((t) => known.has(t));
      const m = item.match(/\(([^)]+)\)/);
      note = m ? m[1] : "";
    } else if (Array.isArray(item)) {
      found = item.map(String).filter((t) => known.has(t));
    } else if (item && typeof item === "object") {
      // Flask sends {"section_a": {...full row}, "section_b": {...}}, so look inside nested rows too.
      found = Object.values(item)
        .map((v) => (v && typeof v === "object" ? pick(v, ["section_id", "id"]) : v))
        .map(String)
        .filter((t) => known.has(t));
      note = pick(item, ["reason", "message", "days", "overlap"]) || "";
    }
    return [found[0], found[1], String(note)];
  }).filter(([a, b]) => a && b);
}

export function rmpLink(professor) {
  return `https://www.ratemyprofessors.com/search/professors?q=${encodeURIComponent(professor)}`;
}

// Saved plans (up to three schedules side by side), undo, and share links.
// Everything is kept in this browser with localStorage. Storage can be
// blocked (private windows), so every read and write is wrapped.

const KEY = "ezclass.plans.v2";          // Fall 2026 plans from the earlier version
const OLD_KEY = "ezclass.schedule.v1";
const TERM_KEY = "ezclass.term";

// Terms the planner offers. "id" goes in links and storage; "label" is what
// students see and what the page sends to the API as ?term=.
export const TERMS = [
  { id: "fall-2026", label: "Fall 2026" },
  { id: "spring-2027", label: "Spring 2027" },
  { id: "summer-2027", label: "Summer 2027", note: "Summer sessions are shorter, so most classes meet four days a week in longer blocks." },
];
export const termById = (id) => TERMS.find((t) => t.id === id) || TERMS[0];

export function loadTerm() {
  try { const t = localStorage.getItem(TERM_KEY); return TERMS.some((x) => x.id === t) ? t : TERMS[0].id; } catch { return TERMS[0].id; }
}
export function saveTerm(id) {
  try { localStorage.setItem(TERM_KEY, id); } catch { /* blocked */ }
}
const planKey = (termId) => `${KEY}.${termId}`;
export const MAX_PLANS = 3;
const NAMES = ["Plan A", "Plan B", "Plan C"];

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

// Each term keeps its own Plan A, B, and C.
export function loadPlans(termId = TERMS[0].id) {
  let saved = read(planKey(termId));
  if (!saved && termId === "fall-2026") saved = read(KEY); // carry over plans made before terms existed
  if (saved && Array.isArray(saved.plans) && saved.plans.length) {
    return { plans: saved.plans, active: Math.min(saved.active || 0, saved.plans.length - 1) };
  }
  const old = termId === "fall-2026" ? read(OLD_KEY) : null; // schedule saved by the first version
  return { plans: [{ name: NAMES[0], sections: Array.isArray(old) ? old : [] }], active: 0 };
}

export function savePlans(termId, store) {
  write(planKey(termId), { plans: store.plans, active: store.active });
}

// Busy times (work, practice, commute) belong to a term, not a plan,
// because your job doesn't change when you try Plan B.
export function loadBusy(termId) {
  const saved = read(`ezclass.busy.v1.${termId}`);
  return Array.isArray(saved) ? saved : [];
}
export function saveBusy(termId, busy) {
  write(`ezclass.busy.v1.${termId}`, busy);
}

export function nextPlanName(store) {
  return NAMES.find((n) => !store.plans.some((p) => p.name === n)) || `Plan ${store.plans.length + 1}`;
}

// Theme: "light", "dark", or null for the system setting.
export function loadTheme() {
  try { return localStorage.getItem("ezclass.theme"); } catch { return null; }
}
export function saveTheme(theme) {
  try { theme ? localStorage.setItem("ezclass.theme", theme) : localStorage.removeItem("ezclass.theme"); } catch { /* blocked */ }
}

// Share links look like #spring-2027-s-101-102. Only letters and digits survive in ids.
// Older links without a term (#s-49-50) still open, as Fall 2026.
export function shareHash(termId, sections) {
  const ids = sections.map((s) => String(s.id)).filter((id) => /^[A-Za-z0-9]+$/.test(id));
  return ids.length ? `#${termId}-s-${ids.join("-")}` : "";
}

export function fromHash(hash = location.hash) {
  const m = String(hash).match(/^#(?:([a-z]+-\d{4})-)?s-([A-Za-z0-9-]+)$/);
  if (!m) return null;
  const term = TERMS.some((t) => t.id === m[1]) ? m[1] : TERMS[0].id;
  return { term, ids: m[2].split("-").filter(Boolean) };
}

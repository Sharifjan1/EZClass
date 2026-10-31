// The product shot in the homepage hero. When it comes into view, a week grid
// draws itself, classes drop in, one overlap turns red and moves to a free
// slot, and a "No overlaps" check draws at the end. It plays once, and the
// replay button runs it again. With reduced motion on, the finished week shows
// right away.

const W = 720, H = 560;
const GX = 70, GY = 76, COL = 126, ROW = 46, START_H = 8, HOURS = 10; // grid geometry
const colX = (i) => GX + i * COL;
const timeY = (h) => GY + (h - START_H) * ROW;

// day: 0 = Mon. A class that meets twice gets two entries with the same key.
const BLOCKS = [
  { key: "a", day: 0, s: 9.5, e: 10.75, label: "CS 310", c: 0 },
  { key: "a", day: 2, s: 9.5, e: 10.75, label: "CS 310", c: 0 },
  { key: "b", day: 0, s: 9, e: 10.25, label: "RWS 280", c: 1, moveTo: { day: 1, s: 11 } },
  { key: "b", day: 2, s: 9, e: 10.25, label: "RWS 280", c: 1, moveTo: { day: 3, s: 11 } },
  { key: "c", day: 0, s: 12, e: 13.25, label: "MATH 254", c: 2 },
  { key: "c", day: 2, s: 12, e: 13.25, label: "MATH 254", c: 2 },
  { key: "d", day: 1, s: 15.5, e: 16.75, label: "CS 450", c: 0 },
  { key: "d", day: 3, s: 15.5, e: 16.75, label: "CS 450", c: 0 },
  { key: "e", day: 4, s: 13, e: 15.67, label: "PSY 101", c: 3 },
];
const KEY_ORDER = ["a", "c", "d", "e", "b"];
const DURATION = 5200; // ms for one full play

const clamp = (v) => Math.max(0, Math.min(1, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = (t) => 1 - Math.pow(1 - t, 3);

function buildSVG() {
  const lines = [];
  lines.push(`<rect class="h-frame" x="${GX}" y="${GY}" width="${COL * 5}" height="${ROW * HOURS}" rx="10" pathLength="1"/>`);
  for (let i = 1; i < 5; i++) lines.push(`<line class="h-line" x1="${colX(i)}" y1="${GY}" x2="${colX(i)}" y2="${GY + ROW * HOURS}" pathLength="1"/>`);
  for (let h = 1; h < HOURS; h++) lines.push(`<line class="h-line faint" x1="${GX}" y1="${GY + h * ROW}" x2="${GX + COL * 5}" y2="${GY + h * ROW}" pathLength="1"/>`);

  const heads = ["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) =>
    `<text class="h-day" x="${colX(i) + COL / 2}" y="${GY - 14}" text-anchor="middle">${d}</text>`).join("");
  const times = Array.from({ length: HOURS }, (_, h) => {
    const hr = START_H + h;
    const t = `${((hr + 11) % 12) + 1}${hr < 12 ? "am" : "pm"}`;
    return `<text class="h-time" x="${GX - 10}" y="${timeY(hr) + 4}" text-anchor="end">${h ? t : ""}</text>`;
  }).join("");

  const blocks = BLOCKS.map((b, i) => `
    <g class="h-blk s${b.c}" data-i="${i}">
      <rect x="${colX(b.day) + 5}" y="${timeY(b.s) + 2}" width="${COL - 10}" height="${(b.e - b.s) * ROW - 4}" rx="8"/>
      <text x="${colX(b.day) + 14}" y="${timeY(b.s) + 22}">${b.label}</text>
    </g>`).join("");

  const cx = GX + COL * 5 - 34, cy = GY + ROW * HOURS - 34;
  return `
  <svg viewBox="0 0 ${W} ${H}" class="hero-svg" role="img" aria-labelledby="hero-svg-title">
    <title id="hero-svg-title">A weekly class schedule fills in. Two classes overlap, one moves to a free time, and the week ends with no overlaps.</title>
    <defs>
      <pattern id="h-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" class="h-hatch-bg"/><rect width="3" height="8" class="h-hatch-stripe"/>
      </pattern>
    </defs>
    <g class="h-grid">${lines.join("")}${heads}${times}</g>
    <g class="h-blocks">${blocks}</g>
    <g class="h-done">
      <circle class="h-done-ring" cx="${cx}" cy="${cy}" r="22" pathLength="1"/>
      <path class="h-done-tick" d="M ${cx - 9} ${cy + 1} l 6 7 l 13 -15" pathLength="1"/>
      <text class="h-done-text" x="${cx - 32}" y="${cy + 5}" text-anchor="end">No overlaps</text>
    </g>
  </svg>`;
}

export function initHero() {
  const stage = document.getElementById("hero-art");
  if (!stage) return;
  stage.innerHTML = buildSVG();

  const svg = stage.querySelector("svg");
  const lines = [...svg.querySelectorAll(".h-frame, .h-line")];
  const labels = [...svg.querySelectorAll(".h-day, .h-time")];
  const blocks = [...svg.querySelectorAll(".h-blk")];
  const ring = svg.querySelector(".h-done-ring");
  const tick = svg.querySelector(".h-done-tick");
  const doneText = svg.querySelector(".h-done-text");
  const status = document.getElementById("hero-status");
  const replay = document.getElementById("hero-replay");

  function paint(p) {
    lines.forEach((l, i) => { l.style.strokeDashoffset = String(1 - ease(seg(p, i * 0.01, 0.2 + i * 0.01))); });
    labels.forEach((l) => { l.style.opacity = String(seg(p, 0.12, 0.24)); });

    const clashOn = p >= 0.5 && p < 0.7;
    blocks.forEach((g, i) => {
      const b = BLOCKS[i];
      const k = KEY_ORDER.indexOf(b.key);
      const t = ease(seg(p, 0.22 + k * 0.05, 0.34 + k * 0.05));
      let dx = 0, dy = -24 * (1 - t);
      if (b.moveTo) {
        const m = ease(seg(p, 0.68, 0.8));
        dx += (colX(b.moveTo.day) - colX(b.day)) * m;
        dy += (timeY(b.moveTo.s) - timeY(b.s)) * m;
      }
      g.setAttribute("transform", `translate(${dx} ${dy})`);
      g.style.opacity = String(t);
      g.classList.toggle("clash", clashOn && (b.key === "a" || b.key === "b"));
    });

    ring.style.strokeDashoffset = String(1 - ease(seg(p, 0.82, 0.92)));
    ring.style.fillOpacity = String(seg(p, 0.84, 0.94));
    tick.style.strokeDashoffset = String(1 - ease(seg(p, 0.87, 0.96)));
    doneText.style.opacity = String(seg(p, 0.9, 1));

    if (status) {
      const msg = p < 0.22 ? "Setting up your week…" : p < 0.5 ? "Adding classes…" : p < 0.7 ? "CS 310 and RWS 280 overlap" : p < 0.84 ? "Moving RWS 280 to a free slot…" : "All 5 classes fit";
      if (status.textContent !== msg) status.textContent = msg;
      status.dataset.state = p >= 0.5 && p < 0.7 ? "bad" : p >= 0.84 ? "good" : "";
    }
  }

  let raf = 0;
  function play() {
    cancelAnimationFrame(raf);
    const t0 = performance.now();
    const step = (now) => {
      const p = clamp((now - t0) / DURATION);
      paint(p);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    paint(1);
  } else {
    paint(0);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); play(); }
    }, { threshold: 0.35 });
    io.observe(stage);
  }
  replay?.addEventListener("click", () => (reduce ? paint(1) : play()));
}

// Line icons draw themselves when they scroll into view. Anything already on
// screen at load stays fully drawn.
export function initDrawOnScroll() {
  const items = [...document.querySelectorAll("[data-draw]")];
  if (!items.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("drawn");
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.4 });
  for (const el of items) {
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) continue;
    el.classList.add("armed");
    io.observe(el);
  }
}

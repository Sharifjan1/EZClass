// The scroll scene at the top of the page. Six bits of registration clutter
// float around: an expired portal tab, a professor rating, a sticky note, a
// group chat, an old screenshot, and a countdown. As you scroll, each one gets
// pulled into the middle and disappears, the tab counter ticks down, a week
// grid draws itself, classes drop in, one overlap turns red and moves to a
// free slot, and a check mark draws at the end. With reduced motion on, the
// finished week shows right away.

const W = 720, H = 560;
const GX = 70, GY = 76, COL = 126, ROW = 46, START_H = 8, HOURS = 10; // grid geometry
const colX = (i) => GX + i * COL;
const timeY = (h) => GY + (h - START_H) * ROW;
const PULL = { x: GX + COL * 2.5, y: GY + ROW * 5 }; // where the clutter gets pulled to

function star(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

// Each scrap draws itself in local coordinates, (0,0) to (w,h).
const SCRAPS = [
  {
    id: "portal", x: 22, y: 34, w: 290, h: 128, r: -5, spin: -40,
    draw: (w, h) => `
      <rect class="sc-card" width="${w}" height="${h}" rx="12"/>
      <path class="sc-bar" d="M0 12a12 12 0 0 1 12-12h${w - 24}a12 12 0 0 1 12 12v18H0z"/>
      <circle class="sc-light r" cx="16" cy="15" r="4"/><circle class="sc-light y" cx="29" cy="15" r="4"/><circle class="sc-light g" cx="42" cy="15" r="4"/>
      <rect class="sc-url" x="56" y="7" width="${w - 68}" height="16" rx="8"/>
      <text class="sc-url-t" x="66" y="19">webportal.sdsu.edu/classes</text>
      <g transform="translate(32 ${h / 2 + 16})"><g class="sc-spin"><circle class="sc-spin-track" r="12"/><path class="sc-spin-arc" d="M0-12a12 12 0 0 1 12 12"/></g></g>
      <text class="sc-strong" x="56" y="${h / 2 + 10}">Your session expired</text>
      <text class="sc-soft" x="56" y="${h / 2 + 30}">Log in again to see open seats</text>`,
  },
  {
    id: "rmp", x: 402, y: 14, w: 270, h: 108, r: 4, spin: 50,
    draw: (w) => `
      <rect class="sc-card" width="${w}" height="108" rx="12"/>
      <text class="sc-kicker" x="16" y="26">PROFESSOR RATING</text>
      <text class="sc-strong" x="16" y="50">Prof. Kim, CS 310</text>
      ${[0, 1, 2, 3, 4].map((i) => `<polygon class="sc-star${i < 4 ? " on" : ""}" points="${star(26 + i * 20, 72, 8)}"/>`).join("")}
      <text class="sc-strong" x="124" y="77">4.2</text>
      <text class="sc-soft" x="16" y="98">81% would take again, "tough exams"</text>`,
  },
  {
    id: "note", x: 72, y: 212, w: 196, h: 132, r: 3, spin: -60,
    draw: (w, h) => `
      <path class="sc-note" d="M0 0h${w}v${h - 22}l-22 22H0z"/>
      <path class="sc-note-fold" d="M${w} ${h - 22}h-22v22z"/>
      <rect class="sc-tape" x="${w / 2 - 30}" y="-9" width="60" height="18" rx="2" transform="rotate(-4 ${w / 2} 0)"/>
      <text class="sc-hand" x="16" y="42">MWF 9:00 and</text>
      <text class="sc-hand" x="16" y="70">TTh 9:30...</text>
      <text class="sc-hand big" x="16" y="104">do these overlap??</text>`,
  },
  {
    id: "chat", x: 412, y: 164, w: 270, h: 98, r: -3, spin: 70,
    draw: (w) => `
      <rect class="sc-card" width="${w}" height="98" rx="12"/>
      <circle class="sc-avatar" cx="26" cy="28" r="13"/><text class="sc-avatar-t" x="26" y="33" text-anchor="middle">J</text>
      <text class="sc-kicker" x="48" y="24">JESS, CS 450 GROUP CHAT</text>
      <rect class="sc-bubble" x="48" y="34" width="${w - 64}" height="30" rx="15"/>
      <text class="sc-bubble-t" x="62" y="54">is CS 450 full already??</text>
      <rect class="sc-typing" x="48" y="72" width="46" height="18" rx="9"/>
      <circle class="sc-dotty d1" cx="60" cy="81" r="3"/><circle class="sc-dotty d2" cx="71" cy="81" r="3"/><circle class="sc-dotty d3" cx="82" cy="81" r="3"/>
      <text class="sc-soft" x="104" y="86">3 people are typing</text>`,
  },
  {
    id: "shot", x: 100, y: 376, w: 230, h: 150, r: -4, spin: -50,
    draw: (w, h) => {
      const gx = 14, gy = 14, gw = w - 28, gh = h - 50, cw = gw / 5;
      const cells = [[0, 0.1, 0.3, 0], [2, 0.1, 0.3, 0], [1, 0.45, 0.3, 1], [3, 0.45, 0.3, 1], [0, 0.2, 0.3, 2], [4, 0.6, 0.35, 3]];
      return `
      <rect class="sc-card" width="${w}" height="${h}" rx="10"/>
      <rect class="sc-mini" x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="4"/>
      ${[1, 2, 3, 4].map((i) => `<line class="sc-mini-l" x1="${gx + i * cw}" y1="${gy}" x2="${gx + i * cw}" y2="${gy + gh}"/>`).join("")}
      ${cells.map(([d, t, len, c]) => `<rect class="sc-mini-b s${c}" x="${gx + d * cw + 3}" y="${gy + t * gh}" width="${cw - 6}" height="${len * gh}" rx="3"/>`).join("")}
      <path class="sc-x" d="M${gx + 18} ${gy + 12}L${gx + gw - 18} ${gy + gh - 12}M${gx + gw - 18} ${gy + 12}L${gx + 18} ${gy + gh - 12}"/>
      <text class="sc-file" x="14" y="${h - 14}">schedule_FINAL_v3 (2).png</text>`;
    },
  },
  {
    id: "clock", x: 424, y: 316, w: 256, h: 118, r: 5, spin: 45,
    draw: (w) => `
      <rect class="sc-card" width="${w}" height="118" rx="12"/>
      <text class="sc-kicker" x="16" y="26">YOUR REGISTRATION OPENS IN</text>
      <text class="sc-count" id="sc-count" x="16" y="68">02:14:09</text>
      <rect class="sc-badge" x="16" y="82" width="104" height="24" rx="12"/>
      <text class="sc-badge-t" x="68" y="98" text-anchor="middle">Waitlist #14</text>
      <text class="sc-soft" x="132" y="98">for PSY 101</text>`,
  },
];
const PULL_ORDER = ["portal", "rmp", "chat", "shot", "clock", "note"];

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

const clamp = (v) => Math.max(0, Math.min(1, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;

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

  const scraps = SCRAPS.map((sc, i) => {
    const cx = sc.x + sc.w / 2, cy = sc.y + sc.h / 2;
    return `
    <g class="h-scrap" data-id="${sc.id}">
      <g transform="rotate(${sc.r} ${cx} ${cy}) translate(${sc.x} ${sc.y})">
        <g class="h-float" style="animation-delay:${-i * 0.9}s">${sc.draw(sc.w, sc.h)}</g>
      </g>
    </g>`;
  }).join("");

  // A hand-drawn loop around the sticky note
  const n = SCRAPS.find((s) => s.id === "note");
  const scribble = `M ${n.x - 8} ${n.y - 16} C ${n.x + 90} ${n.y - 48}, ${n.x + 236} ${n.y - 30}, ${n.x + 228} ${n.y + 62}
    C ${n.x + 222} ${n.y + 154}, ${n.x + 60} ${n.y + 168}, ${n.x - 16} ${n.y + 126}
    C ${n.x - 58} ${n.y + 98}, ${n.x - 46} ${n.y + 10}, ${n.x + 40} ${n.y - 26}`;

  const cx = GX + COL * 5 - 34, cy = GY + ROW * HOURS - 34;
  return `
  <svg viewBox="0 0 ${W} ${H}" class="hero-svg" role="img" aria-labelledby="hero-svg-title">
    <title id="hero-svg-title">An expired portal page, a professor rating, a sticky note, a group chat, an old schedule screenshot, and a registration countdown get pulled together into one weekly schedule with no overlaps.</title>
    <defs>
      <pattern id="h-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" class="h-hatch-bg"/><rect width="3" height="8" class="h-hatch-stripe"/>
      </pattern>
    </defs>
    <g class="h-grid">${lines.join("")}${heads}${times}</g>
    <g class="h-blocks">${blocks}</g>
    <circle class="h-pulse" cx="${PULL.x}" cy="${PULL.y}" r="10"/>
    <g class="h-scraps">${scraps}</g>
    <path class="h-scribble" d="${scribble}" pathLength="1"/>
    <g class="h-done">
      <circle class="h-done-ring" cx="${cx}" cy="${cy}" r="22" pathLength="1"/>
      <path class="h-done-tick" d="M ${cx - 9} ${cy + 1} l 6 7 l 13 -15" pathLength="1"/>
      <text class="h-done-text" x="${cx - 32}" y="${cy + 5}" text-anchor="end">No overlaps</text>
    </g>
  </svg>`;
}

// The fake countdown on the clock card. Purely for show.
function startCountdown(svg) {
  const el = svg.querySelector("#sc-count");
  if (!el) return;
  const START = 2 * 3600 + 14 * 60 + 9;
  let left = START;
  const pad = (n) => String(n).padStart(2, "0");
  setInterval(() => {
    if (document.hidden) return;
    left = left > 0 ? left - 1 : START;
    el.textContent = `${pad(Math.floor(left / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;
  }, 1000);
}

export function initHero() {
  const stage = document.getElementById("hero-art");
  const track = document.getElementById("hero-track");
  if (!stage || !track) return;
  stage.innerHTML = buildSVG();

  const svg = stage.querySelector("svg");
  const scraps = [...svg.querySelectorAll(".h-scrap")].map((g) => ({ g, sc: SCRAPS.find((s) => s.id === g.dataset.id) }));
  const scribble = svg.querySelector(".h-scribble");
  const pulse = svg.querySelector(".h-pulse");
  const lines = [...svg.querySelectorAll(".h-frame, .h-line")];
  const labels = [...svg.querySelectorAll(".h-day, .h-time")];
  const blocks = [...svg.querySelectorAll(".h-blk")];
  const ring = svg.querySelector(".h-done-ring");
  const tick = svg.querySelector(".h-done-tick");
  const doneText = svg.querySelector(".h-done-text");
  const before = document.querySelector(".hh-before");
  const after = document.querySelector(".hh-after");
  const hint = document.querySelector(".scroll-hint");
  const counter = document.getElementById("tab-count");
  const counterText = document.getElementById("tab-count-text");
  let lastCount = SCRAPS.length;

  startCountdown(svg);

  function paint(p) {
    let gone = 0;
    for (const { g, sc } of scraps) {
      const k = PULL_ORDER.indexOf(sc.id);
      const t = easeIn(seg(p, 0.08 + k * 0.035, 0.26 + k * 0.035));
      const cx = sc.x + sc.w / 2, cy = sc.y + sc.h / 2;
      const px = cx + (PULL.x - cx) * t, py = cy + (PULL.y - cy) * t;
      g.setAttribute("transform", `translate(${px} ${py}) rotate(${sc.spin * t}) scale(${1 - 0.94 * t}) translate(${-cx} ${-cy})`);
      g.style.opacity = String(1 - seg(t, 0.75, 1));
      if (t >= 0.95) gone++;
    }

    scribble.style.strokeDashoffset = String(seg(p, 0.02, 0.14));
    scribble.style.opacity = String(1 - seg(p, 0.12, 0.15)); // hides the round cap left behind

    const pu = seg(p, 0.3, 0.46);
    pulse.setAttribute("r", String(10 + 70 * ease(pu)));
    pulse.style.opacity = String(pu > 0 && pu < 1 ? 0.5 * (1 - pu) : 0);

    lines.forEach((l, i) => { l.style.strokeDashoffset = String(1 - ease(seg(p, 0.36 + i * 0.008, 0.54 + i * 0.008))); });
    labels.forEach((l) => { l.style.opacity = String(seg(p, 0.46, 0.55)); });

    const clashOn = p >= 0.66 && p < 0.79;
    blocks.forEach((g, i) => {
      const b = BLOCKS[i];
      const k = KEY_ORDER.indexOf(b.key);
      const t = ease(seg(p, 0.52 + k * 0.03, 0.61 + k * 0.03));
      let dx = 0, dy = -24 * (1 - t);
      if (b.moveTo) {
        const m = ease(seg(p, 0.78, 0.86));
        dx += (colX(b.moveTo.day) - colX(b.day)) * m;
        dy += (timeY(b.moveTo.s) - timeY(b.s)) * m;
      }
      g.setAttribute("transform", `translate(${dx} ${dy})`);
      g.style.opacity = String(t);
      g.classList.toggle("clash", clashOn && (b.key === "a" || b.key === "b"));
    });

    ring.style.strokeDashoffset = String(1 - ease(seg(p, 0.85, 0.91)));
    ring.style.fillOpacity = String(seg(p, 0.86, 0.92));
    tick.style.strokeDashoffset = String(1 - ease(seg(p, 0.88, 0.93)));
    doneText.style.opacity = String(seg(p, 0.89, 0.94));

    const swap = seg(p, 0.38, 0.5);
    if (before && after) {
      before.style.opacity = String(1 - swap);
      before.style.transform = `translateY(${-14 * swap}px)`;
      after.style.opacity = String(swap);
      after.style.transform = `translateY(${14 * (1 - swap)}px)`;
    }
    if (hint) hint.style.opacity = String(1 - seg(p, 0, 0.06));

    // "6 tabs open" counts down as each scrap disappears.
    const left = SCRAPS.length - gone;
    if (counter && left !== lastCount) {
      const done = left === 0;
      counterText.textContent = done ? "1 tab open: this one" : `${left} ${left === 1 ? "tab" : "tabs"} open`;
      counter.classList.toggle("done", done);
      counter.classList.remove("bump");
      void counter.offsetWidth; // restart the bump animation
      counter.classList.add("bump");
      lastCount = left;
    }
  }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let ticking = false;

  // 0 when the scene first sticks under the top bar, 1 when it lets go.
  const sticky = stage.closest(".hero-stage");
  function progress() {
    const stickTop = parseFloat(getComputedStyle(sticky).top) || 0;
    const total = track.offsetHeight - sticky.offsetHeight;
    return total > 0 ? clamp((stickTop - track.getBoundingClientRect().top) / total) : 1;
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; paint(progress()); });
  }
  function setup() {
    document.documentElement.classList.toggle("still-hero", reduce.matches);
    if (reduce.matches) {
      window.removeEventListener("scroll", onScroll);
      paint(1);
    } else {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      paint(progress());
    }
  }
  reduce.addEventListener?.("change", setup);
  setup();
}

// Line icons in the "how it works" band draw themselves when they scroll
// into view. Anything already on screen at load stays fully drawn.
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
    if (r.top < window.innerHeight) continue;
    el.classList.add("armed");
    io.observe(el);
  }
}

// The command palette: press Ctrl+K (Cmd+K on a Mac) or click Search in the
// top bar, type anything, and jump there. Courses, sections, professors,
// terms, plans, and page actions all live in one list.
// app.js supplies the items; this file only handles the box and the keyboard.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Every word typed has to appear somewhere in the item. Earlier and
// word-start matches rank higher.
export function score(query, haystack) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  const h = haystack.toLowerCase();
  const squashed = h.replace(/\s+/g, "");
  let total = 0;
  for (const w of words) {
    let i = h.indexOf(w);
    if (i === -1) {
      i = squashed.indexOf(w); // "cs310" finds "CS 310"
      if (i === -1) return 0;
      total += 2;
      continue;
    }
    total += 10 - Math.min(i, 9) / 3 + (i === 0 || h[i - 1] === " " ? 4 : 0);
  }
  return total;
}

export function createPalette({ dialog, input, list, getItems }) {
  let items = [];
  let active = 0;

  function render() {
    items = getItems(input.value.trim());
    active = Math.min(active, Math.max(0, items.length - 1));
    if (!items.length) {
      list.innerHTML = `<li class="pal-empty">Nothing matches "${esc(input.value.trim())}". Try a course number like CS 310, a professor's last name, or a word like "plan".</li>`;
      input.removeAttribute("aria-activedescendant");
      return;
    }
    let lastGroup = "";
    list.innerHTML = items.map((it, i) => {
      const head = it.group !== lastGroup ? `<li class="pal-group" role="presentation">${esc(it.group)}</li>` : "";
      lastGroup = it.group;
      return `${head}<li class="pal-item" role="option" id="pal-${i}" data-i="${i}" aria-selected="${i === active}">
        ${it.badge ? `<span class="code ${esc(it.badgeClass || "")}">${esc(it.badge)}</span>` : `<span class="pal-icon" aria-hidden="true">${it.icon || "›"}</span>`}
        <span class="pal-text"><span class="pal-label">${esc(it.label)}</span>${it.meta ? `<span class="pal-meta">${esc(it.meta)}</span>` : ""}</span>
        ${it.hint ? `<kbd>${esc(it.hint)}</kbd>` : ""}
      </li>`;
    }).join("");
    input.setAttribute("aria-activedescendant", `pal-${active}`);
    list.querySelector(`#pal-${active}`)?.scrollIntoView({ block: "nearest" });
  }

  function move(d) {
    if (!items.length) return;
    active = (active + d + items.length) % items.length;
    for (const el of list.querySelectorAll(".pal-item")) el.setAttribute("aria-selected", String(Number(el.dataset.i) === active));
    input.setAttribute("aria-activedescendant", `pal-${active}`);
    list.querySelector(`#pal-${active}`)?.scrollIntoView({ block: "nearest" });
  }

  function run(i) {
    const it = items[i];
    if (!it) return;
    close();
    // Let the dialog finish closing before the action moves focus or scrolls.
    requestAnimationFrame(() => it.run());
  }

  function open(prefill = "") {
    input.value = prefill;
    active = 0;
    render();
    if (!dialog.open) dialog.showModal();
    input.focus();
    input.select();
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  input.addEventListener("input", () => { active = 0; render(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter") { e.preventDefault(); run(active); }
  });
  list.addEventListener("click", (e) => {
    const li = e.target.closest(".pal-item");
    if (li) run(Number(li.dataset.i));
  });
  list.addEventListener("pointermove", (e) => {
    const li = e.target.closest(".pal-item");
    if (li && Number(li.dataset.i) !== active) { active = Number(li.dataset.i); move(0); }
  });
  dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); }); // click outside the box

  return { open, close, isOpen: () => dialog.open };
}

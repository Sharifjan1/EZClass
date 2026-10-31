// Page switching. The site is one HTML file with several <main data-page>
// sections. "#/about", "#/blog", "#/blog/some-post" and so on pick a page.
// Any other hash ("#planner", "#faq", a share link) stays on the home page,
// so in-page links and share links keep working.

import { POSTS, formatDate, readMinutes } from "./content.js";

export const PAGES = ["home", "about", "team", "blog", "deliverables", "privacy", "terms"];
const TITLES = {
  home: "EzClass: plan a conflict-free semester",
  about: "About us · EzClass",
  team: "Meet the team · EzClass",
  blog: "Blog · EzClass",
  deliverables: "Deliverables · EzClass",
  privacy: "Privacy · EzClass",
  terms: "Terms · EzClass",
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function parseRoute(hash = location.hash) {
  const m = hash.match(/^#\/([a-z-]*)(?:\/([a-z0-9-]+))?\/?$/);
  if (m) {
    const page = m[1] || "home";
    if (PAGES.includes(page)) return { page, sub: m[2] || "", anchor: "" };
  }
  const anchor = /^#[a-z][\w-]*$/i.test(hash) ? hash.slice(1) : "";
  return { page: "home", sub: "", anchor };
}

let current = null;
const listeners = [];
export const currentPage = () => current;
export const onPageChange = (fn) => listeners.push(fn);

function postCard(p) {
  return `
    <article class="post-card">
      <a href="#/blog/${p.slug}" class="post-card-link">
        <p class="post-meta"><span class="post-tag">${esc(p.tag)}</span><time datetime="${p.date}">${formatDate(p.date)}</time></p>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.excerpt)}</p>
        <span class="post-more">Read the post <span aria-hidden="true">→</span></span>
      </a>
    </article>`;
}

function renderBlog(slug) {
  const box = document.getElementById("blog-body");
  if (!box) return "Blog";
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) {
    box.innerHTML = `<div class="post-grid">${POSTS.map(postCard).join("")}</div>`;
    return "Blog";
  }
  const i = POSTS.indexOf(post);
  const newer = POSTS[i - 1], older = POSTS[i + 1];
  const body = post.body.map((t) => (t.startsWith("## ") ? `<h2>${esc(t.slice(3))}</h2>` : `<p>${esc(t)}</p>`)).join("");
  box.innerHTML = `
    <article class="post">
      <a class="back-link" href="#/blog"><span aria-hidden="true">←</span> All posts</a>
      <p class="post-meta"><span class="post-tag">${esc(post.tag)}</span><time datetime="${post.date}">${formatDate(post.date)}</time><span>${readMinutes(post)} min read</span></p>
      <h1 class="post-title" tabindex="-1">${esc(post.title)}</h1>
      <p class="post-by">By ${esc(post.author)}</p>
      <div class="post-body">${body}</div>
      <nav class="post-nav" aria-label="More posts">
        ${older ? `<a href="#/blog/${older.slug}"><span>Older</span>${esc(older.title)}</a>` : "<span></span>"}
        ${newer ? `<a class="newer" href="#/blog/${newer.slug}"><span>Newer</span>${esc(newer.title)}</a>` : ""}
      </nav>
    </article>`;
  return post.title;
}

export function renderLatestPosts(n = 3) {
  const box = document.getElementById("latest-posts");
  if (box) box.innerHTML = POSTS.slice(0, n).map(postCard).join("");
}

// Links for other pages are marked by route. The home page's own links
// (Product, Planner) are handled by the scroll spy in app.js.
function setNavCurrent(page) {
  for (const a of document.querySelectorAll("[data-route]")) {
    if (a.dataset.spy) { if (page !== "home") a.removeAttribute("aria-current"); continue; }
    if (a.dataset.route === page) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

export function render({ initial = false } = {}) {
  const { page, sub, anchor } = parseRoute();
  const changed = page !== current;
  for (const el of document.querySelectorAll("main[data-page]")) el.hidden = el.dataset.page !== page;
  document.documentElement.dataset.page = page;

  let title = TITLES[page];
  if (page === "blog") {
    const postTitle = renderBlog(sub);
    if (sub && postTitle !== "Blog") title = `${postTitle} · EzClass`;
  }
  document.title = title;
  setNavCurrent(page);

  const html = document.documentElement;
  const prev = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";
  if (anchor) {
    const el = document.getElementById(anchor);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "start", behavior: changed || initial ? "auto" : "smooth" }));
  } else if (!initial || page !== "home") {
    window.scrollTo(0, 0);
  }
  html.style.scrollBehavior = prev;

  // Move focus to the new page's heading so screen readers announce it.
  if (!initial && !anchor && (changed || sub)) {
    const h = document.querySelector(`main[data-page="${page}"] h1`);
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }

  current = page;
  for (const fn of listeners) fn(page, { changed, sub, anchor });
}

export function goHome(anchor = "") {
  if (current === "home") return false;
  history.pushState(null, "", anchor ? `#${anchor}` : location.pathname + location.search);
  render();
  return true;
}

export function initRouter() {
  window.addEventListener("hashchange", () => render());
  // Clicking a link to the hash you're already on doesn't fire hashchange,
  // so handle "back to top" and same-section links here.
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    const href = a.getAttribute("href");
    const same = href === location.hash || (href === "#/" && (location.hash === "" || location.hash === "#"));
    if (!same) return;
    e.preventDefault();
    if (href.startsWith("#/")) window.scrollTo({ top: 0, behavior: "smooth" });
    else document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  renderLatestPosts();
  render({ initial: true });
}

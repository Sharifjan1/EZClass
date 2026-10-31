# EzClass frontend (Phase 2)

Plain HTML, CSS, and JavaScript. No framework and no npm install. It talks to the Flask routes from the Phase 1 doc: `/api/health`, `/api/subjects`, `/api/sections`, and `/api/schedule/check`.

## What's in it

EzClass is set up as a small company site with the planner built in. It's still one HTML file, and the address after `#/` picks the page:

- `#/` Home: red hero with a live week animation, "What is EzClass?" with the acronym (Easy, Zero-Conflict Lineups for Aztec Student Schedules), key features, how to use it, the planner, a team band, the latest blog posts, FAQ.
- `#/about` Our story, what the name stands for, mission, values, timeline.
- `#/team` Meet the team.
- `#/blog` and `#/blog/<post>` Blog. Posts live in `js/content.js`. To add one, copy an entry, give it a new `slug`, and put it first.
- `#/deliverables` Phases and what's done, in progress, or planned.
- `#/privacy` and `#/terms` Policy pages.

Links like `#planner` and `#faq` and share links still work from any page, because anything that isn't `#/something` opens the home page. Deliverables, About, Privacy, and Terms are in the footer. On phones, the menu button in the top right opens every page.

Getting around:

- Search everything with Ctrl+K (Cmd+K on a Mac) or the search box in the top bar: courses, sections, professors, terms, plans, and actions like "check for conflicts". Picking a course jumps to it in the list; picking a section adds it to your plan.
- Keyboard shortcuts: `/` search the list, `A` auto-build, `B` browse, `1` `2` `3` plans, `T` next term, `?` shows them all.
- On phones, a bottom bar switches between Find, Auto-build, My week, and Search.
- Returning visitors with a saved plan skip the intro and land on the planner. Everyone else can hit "Skip intro".
- An empty plan shows a three-step guide with buttons for Browse and Auto-build.
- The top bar highlights which part of the page you're on.

The planner has:

- Busy times. Drag on an empty part of the week grid (or use "Block out time") to block out work, practice, a commute, or anything else. Busy times are saved per term and shared by all your plans. Classes that land on one get flagged in the list and on the grid, the conflict check reports them, and Auto-build never schedules over them.
- Compare plans: a side-by-side table of Plan A, B, and C with a week thumbnail, units, days on campus, first and last class, gaps, and overlaps.
- A term switcher for Fall 2026, Spring 2027, and Summer 2027. Each term has its own sections and its own saved plans, so switching never mixes them. Share links include the term. Add or change terms in the `TERMS` list in `js/store.js`.
- Search by course, title, or professor, updating as you type. Press `/` to jump to search.
- A subject filter that takes several subjects at once, a "days I can be on campus" filter, and an upper-division filter (300 to 599).
- Sections grouped by course, with a small M T W Th F strip on each row so you can read the meeting pattern at a glance.
- Live preview: point at a section and a dashed copy shows up on your week. It turns red if it would overlap something.
- A note on each row that clashes with your plan, or that you already have another section of that course.
- Auto-build: list the courses you need, set "no classes before/after", pick days off, and rank by fewest days on campus, shortest gaps, or latest start. It tries every combination and shows the ones with no overlaps, each with a tiny week thumbnail. Click one to preview it, then "Use this schedule".
- Up to three plans (Plan A, B, C) saved in the browser.
- Week stats: units, hours in class, days on campus, first class, longest gap, and tight walks. A tight walk is two classes on the same day in different buildings with 15 minutes or less between them. The first one gets a note under the stats, and Compare plans counts them too.
- Click any class on the grid for details and a Remove button.
- Check for conflicts (asks the server), Undo after removing or clearing, and a share link that loads the same classes for whoever opens it.
- "Add to calendar" makes an .ics file with every class as a weekly repeating event.
- "Print / PDF" (or press `P`, or Ctrl+P) prints a clean one-page sheet of the plan: term and plan name, week stats, the week grid, a table of every class with room, professor, and units, plus any overlaps, tight walks, and busy times. Pick "Save as PDF" in the print dialog to get a file. The sheet is built in `js/print.js` and only shows when printing.
- Light and dark themes, a layout that works on phones, keyboard support, and reduced-motion support.

## Files

```
index.html               page layout
css/style.css            all styles, light and dark
js/app.js                page logic: filters, list, plans, week panel, auto-build UI
js/api.js                every call to Flask, plus the step that cleans up the JSON
js/time.js               day patterns, times, and the overlap rule (same as conflicts.py)
js/calendar.js           the week grid
js/builder.js            the auto-build search and ranking (no DOM, easy to test)
js/stats.js              units, hours, gaps
js/store.js              saved plans, theme, share links
js/ics.js                calendar file export
js/print.js              the printable schedule sheet (Print / PDF)
js/hero.js               the week animation in the hero, and icons that draw on scroll
js/router.js             switches between the pages (#/about, #/blog, ...)
js/content.js            the blog posts
js/palette.js            the Ctrl+K search box
js/sample-data.js        made-up sections for working without the server
tools/build_preview.py   bundles everything into one HTML file for showing people
```

If you split the work: one person takes `app.js`, `api.js`, and `builder.js`; the other takes `calendar.js`, `hero.js`, and `style.css`.

## Running it

Without the backend, from this folder:

```
python3 -m http.server 8000
```

Open http://localhost:8000/?sample. Opening `index.html` by double-clicking won't work, because browsers block JavaScript modules on `file://` pages.

With Flask, copy this folder into the project as `frontend/` and point Flask at it in `backend/app.py`:

```python
app = Flask(__name__, static_folder="../frontend", static_url_path="")

@app.route("/")
def index():
    return app.send_static_file("index.html")
```

Run the server and open http://localhost:5000. If `/api/health` doesn't answer, the page switches to sample data and shows a "Sample data" tag in the top bar.

To make the one-file demo: `python3 tools/build_preview.py`, then open `dist/ezclass-preview.html`.

## Trying it on GitHub Pages

`python3 tools/build_preview.py --pages` writes `dist/index.html`, one file with everything inside. It checks `/api/health` first, so under Flask it uses the real database, and on GitHub Pages (no API there) it switches to sample data by itself.

1. In your fork, on your branch, create `docs/index.html` and paste that file's contents in.
2. Go to Settings, then Pages. Under "Build and deployment", pick "Deploy from a branch", choose your branch and the `/docs` folder, and save.
3. After a minute or two the site is live at `https://YOUR-USERNAME.github.io/EZClass/`.

## Things to check with Mehar

1. JSON field names. `normalizeSection()` in `js/api.js` accepts the usual names (`section_id`, `subject`, `catalog_num`, `first_name`, `last_name`, `days`, `start_time`, `end_time`, `building`, `room_number`, `units`). If a column comes up blank, add the real key to the matching `pick(...)` list. Nothing else needs to change.
2. The conflict check sends `{"section_ids": [49, 50]}` and reads Mehar's reply shape, `{"conflicts": [{"section_a": {...}, "section_b": {...}}], "conflict_free": true}`.
3. "TR" and "TTh" both appear in the data. The frontend reads R as Thursday. If `conflicts.py` doesn't, the server will miss TR vs TTh clashes.
4. The API takes one subject and one day, so the page loads everything and filters in the browser. That's fine for a few hundred sections. With real SDSU data, the backend should accept lists like `?subject=CS&subject=MATH`.
5. Terms. The page sends `?term=Spring%202027` to `/api/sections` and `/api/subjects`, and also keeps only rows whose `term` column matches, so it works whether or not the route filters by term yet. The `sections` table already has a `term` column, so the route only needs `WHERE term = ?`.
6. Auto-build runs in the browser too. It stops at 500 schedules, which is plenty for 3 to 6 courses.

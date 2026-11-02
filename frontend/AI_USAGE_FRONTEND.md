# AI Usage Disclosure: Phase 2 Frontend and Website (Sharifullah Sharifi and Noor Hamdard)

This follows the course AI policy: say where AI was used, how we directed,
changed, or checked it, and be ready to explain every part. It covers the
frontend team's part of the project (Sharif and Noor). The Phase 1 disclosure
is in AI_USAGE.md.

## Summary

We used Claude (Anthropic) for the Phase 2 frontend and the company website.
Claude wrote the first versions of the code, the page text, and the blog posts
from our ideas and feedback. The main ideas came from us: Sharif came up with
the homepage animation and the three-term setup (Fall, Spring, Summer), and Noor
worked on the calendar, edited the code, and hunted down bugs. Sharif revised
the code and put all of it on GitHub through his fork, and set up the live site
on GitHub Pages. Claude wrote most of the first-draft code, and we're stating
that directly.

## Where AI (Claude) was used

| Part | What Claude did | What we did |
| --- | --- | --- |
| frontend/index.html, css/style.css | Wrote the page layout and all the styles (light and dark themes, phone layout) | Sharif asked for the features, the SDSU red look, and the company-site layout, and gave feedback on screenshots. Noor edited the code |
| frontend/js/app.js | Wrote the planner logic: search and filters, week grid, Auto-build, busy times, plan comparison, share links, calendar export, tight-walk warnings | Sharif and Noor came up with the features and tested them in the browser |
| frontend/js/api.js | Wrote the code that talks to the Flask API, and fixed it to read Mehar's conflict-check response | Sharif pointed Claude to Mehar's repo so it could match the real backend |
| frontend/js/builder.js, stats.js, store.js, time.js, ics.js, palette.js | Wrote them | Tested the features they power |
| frontend/js/hero.js | Wrote the code for the homepage animation | Sharif's idea: the animated intro, and later replacing the "six tabs" version with a professional one |
| Terms (Fall 2026, Spring 2027, Summer 2027) | Wrote the term switcher and the separate saved plans per term | Sharif's idea: three terms, each with its own plans |
| frontend/js/calendar.js (the week calendar) | Wrote the first version of the calendar code | Noor worked on the calendar and edited the code |
| frontend/js/router.js, content.js | Wrote the page switching (Home, About, Team, Blog, Deliverables, Privacy, Terms) and the blog posts | Sharif's idea: the company pages and the "from students, to students" story |
| frontend/js/sample-data.js | Wrote made-up sections for testing without the server | Used it for the live demo |
| Site text | Wrote the homepage, About, Team, FAQ, Privacy, and Terms text, the four blog posts, and the EZCLASS acronym (Easy, Zero-Conflict Lineups for Aztec Student Schedules) | Sharif asked for them and reviewed them |
| tools/build_preview.py, docs/index.html | Wrote the script that bundles the site into one file and built docs/index.html | Sharif uploaded it and set up GitHub Pages |
| Testing and bugs | Ran automated browser tests (desktop, phone, light and dark) and fixed the bugs they found | Noor looked for bugs and edited the code. Sharif checked the live site and reported problems (missing bottom bar on desktop, the site showing an old version, files in the wrong folder) |
| GitHub help | Gave step-by-step instructions for forking, branches, uploading, Pages, and adding a collaborator | Sharif forked the repo, made the frontend branch, revised and uploaded the files, turned on GitHub Pages, and added Noor as a collaborator |
| Phase 1 slides and script | Improved the slide deck and speaker notes and drafted a presentation script for all six of us | Sharif and Noor gave the direction, reviewed it, and used it to practice |

## What we did ourselves

| Name | What they did |
| --- | --- |
| Sharifullah Sharifi | Came up with the homepage animation and the three-term setup (Fall, Spring, Summer). Decided the features and the look: easier navigation, the desktop dock, and turning the site into a company site. Forked MeharButtar/EZClass, made the `frontend` branch, revised the code, and uploaded all of it to GitHub. Set up GitHub Pages so the site is live at https://sharifjan1.github.io/EZClass/. Checked the live site and reported problems. |
| Noor Hamdard | Worked on the calendar, edited the code, and looked for bugs. Added to the repo as a collaborator so he can make changes. |

## What was checked

- Each page loads: Home, About, Team, Blog and each post, Deliverables, Privacy, Terms.
- The planner runs on sample data on GitHub Pages and switches to the real API when Flask is running.
- Adding overlapping sections shows a conflict, and back-to-back classes don't.
- The site works on a phone-sized screen and in light and dark mode.

Claude ran automated browser tests for these. Noor looked for bugs, and Sharif
checked the live site by hand.

## Things still to confirm with the team

- The Team page roles and the blog posts were written by Claude from what we
  described. The team should check them before the site is shared.
- The Privacy and Terms pages were not reviewed by a lawyer.

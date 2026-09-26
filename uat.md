# UAT Baseline — Robotics Tracker

> Living UAT plan. Run the **Critical flows** every pass. **Exploration** is open territory — vary it each run. Update `last_tested` per section as you go. New bugs land in `issues.md`.

_Created: 2026-05-18_
_Last run: 2026-09-26_ (scheduled full-site refresh: scroll-depth + mobile-overflow pass on all 10 pages after the energy collapse, policies cap and front-page payload change; 0 dead links, 0 console errors, no overflow at 375px)
_Updated: 2026-06-07_ (documentation update — agencies/news consolidated into policies.html with collapsible sections)

---

## Project info

- **Stack:** vanilla HTML / CSS / JS + JSON data files. Zero runtime dependencies.
- **Dev server:** `node scripts/serve.js` → <http://localhost:8765>. Or via the Claude Code preview tool (`name: tracker` in `.claude/launch.json`).
- **Entry pages:** `docs/index.html`, `docs/companies.html`, `docs/policies.html`, `docs/states.html`, `docs/themes.html`, `docs/china.html`, `docs/supply-chain.html`, `docs/energy.html`.
- **Shared:** `docs/assets/styles.css` + `docs/assets/app.js`.
- **Themes:** four — `caves`, `naked-sun`, `dawn` (default light), `robot-dreams` (default dark). See [DESIGN.md § 15](DESIGN.md).
- **Data:** `docs/data/{companies,policies,news,themes,sources}.json`. Validated by `scripts/validate.js`.

---

## Critical flows (run every pass)

These should always pass. If one regresses, log it as `critical` in `issues.md`.

1. **All eight pages load without console errors.** Visit Dashboard / Companies / Policy / States / Themes / China / Supply-Chain / Energy at the default theme (Dawn) and verify `preview_console_logs --level error` returns empty.
2. **All four themes activate.** From any page, switch through `caves → naked-sun → robot-dreams → dawn` via the picker. After each switch, verify:
   - `document.documentElement.getAttribute('data-theme')` matches the selected theme
   - `localStorage.theme` matches
   - The picker's current-label text matches
   - The body background color changes to the theme's `--bg`
   - Robot Dreams specifically: `getComputedStyle(.kpi-card).backdropFilter` is `blur(12px) saturate(1.4)`
3. **Picker open/close mechanics.**
   - Closed by default after page load (`getComputedStyle(.theme-picker-menu).display === 'none'`)
   - Click summary → opens (`display === 'flex'`)
   - Click a radio → theme changes, picker closes, label updates
   - Escape closes the picker if open
   - Outside click closes the picker if open
4. **Companies filter + detail panel.**
   - Initial render: 20 rows, sorted by valuation; Figure AI first ($39B)
   - Country filter (China) → 5 rows
   - Search "humanoid" → ≤ initial count, all visible rows contain the term in name/tag/etc.
   - Reset clears all filters
   - Row click → detail panel opens with the correct title
   - Escape closes panel; backdrop click closes panel
5. **Policies page — collapsible sections render.**
   - Five collapsible sections: Congressional actions, Executive actions, Federal agencies, Tax & demand-side incentives, State incentives
   - Congressional actions: ≥ 4 rows (HR 7334, HR 8189, OBBBA, CHIPS Act)
   - Executive actions: ≥ 5 rows
   - Federal agencies: ≥ 12 rows (OSTP, DOE, ARPA-E, DOC, NIST, NSF, NASA, Space Force, DARPA, USDA, NIH, DOT)
   - Tax incentives: ≥ 3 rows (Section 174, R&D Tax Credit, Bonus Depreciation)
   - State incentives: ≥ 5 rows
   - Status filter "In effect" → 0 congressional + ≥ 4 executive (bills are never "in effect" — they get "Signed")
6. **Dashboard — recent news feed.**
   - "Recent activity" section shows ≥ 5 news stories, sorted newest-first
   - Each story has a source link with "Read original →"
   - Stories with `archive_url` render an "archived ↗" link (regression guard from 2026-05-18 bug)
7. **Themes — card-grid.**
   - 6 theme cards render in `.themes-grid`
   - Clicking a card opens the bottom-sheet detail panel (`#detail-panel`) with the class `open`
   - Detail panel contains strategic narrative, key metrics, recommended actions, and related companies, policies, and news
   - Escape closes the detail panel; backdrop click closes the detail panel
   - Hash on load opens the matching theme card detail panel
   - **Hashchange post-load also opens the matching theme card detail panel** (regression guard)
8. **Policy detail panel — related news.** Click any policy to open the detail panel. If the policy has tagged news items, the panel shows a "Related news" section with links. Regression test: news is wired correctly across the consolidated page.
9. **Accessibility baseline.**
   - `.skip-link` exists and points to `#main`
   - Skip link's computed `left` becomes `0px` when focused
   - `header[role="banner"]` exists
   - Theme picker summary has `aria-label`; radio group has `aria-label`
   - Focused theme picker shows a 2px outline in the theme's accent color
10. **Mobile (≤540px) doesn't horizontally scroll.** On any page at 358–540px viewport, `document.documentElement.scrollWidth <= innerWidth + 1`.
11. **Schema + cross-ref.** `node scripts/validate.js` exits 0. No broken refs between news → companies/policies/themes or themes → companies/policies/news.

---

## Sections & last-tested

| Section | Last tested | Notes |
|---|---|---|
| Dashboard | 2026-05-18 | Stable. Watch the recent-news + chart-source rendering — they're page-local templates. |
| Companies | 2026-05-18 | Stable. Detail panel is shared via `RT.openDetail`. |
| Policies | 2026-05-23 | Consolidated page with 5 collapsible sections (Congressional, Executive, Agencies, Tax incentives, State). Test section open/close state persistence. |
| States | 2026-05-18 | Stable. State-policy themes page. |
| Themes | 2026-05-18 | Stable post-fix. Hashchange regression worth keeping an eye on. |
| Theme picker | 2026-05-18 | Stable post-fix. The native `<details>` interaction is the source of past bugs — visually verify open/close each pass. |
| Collapsible sections | 2026-05-23 | New. Used on Policies page; state persists in localStorage per section ID. Watch for regression on section toggle. |
| Archive links | 2026-05-18 | Surface on dashboard recent-news; verify each pass. |

---

## Known stable areas

- The four data files' shape + cross-references (covered by `scripts/validate.js`).
- The schema-validator's invariant set (status enums, type enums, required fields).
- The CI pages-deploy workflow.

## Known flaky / unstable areas

- **Collapsible section state persistence** (`<details>` elements) — state is stored in localStorage per section ID. Test that closing a section on one visit keeps it closed on return (within the same session and across sessions). Watch for edge cases like clearing localStorage.
- **Web-font loading** is asynchronous. Theme switches re-apply font-family instantly but the actual face may swap in a few hundred ms later (`font-display: swap`). Don't assert on font metrics inside a single eval.
- **The `<details>` element's hiding semantics** were a footgun — see § 15.4 in DESIGN.md. Any new CSS on `.theme-picker-menu` must keep `display: none` as the closed-state default and only set `display: flex` under `.theme-picker[open] >`.

## Exploration notes (freeform)

Ideas worth checking on future runs, in no particular order:

- Reduced motion: set `prefers-reduced-motion: reduce` in the preview and verify the theme picker chevron rotation and skeleton shimmer are killed.
- Caves of Steel: the green status pill (`--status-positive: #00FF66`) must only appear on dark surfaces; verify it never lands on top of `--surface` (which is the same dark color so contrast holds) but watch for accidental usage on light themes.
- Robot Dreams cyan: anywhere a cyan-filled element holds text, that text must use `--accent-on: #0A0915`. Today this only applies to `.btn.primary`; if a future component fills its bg with `--accent`, add the override.
- Try the iPhone landscape (~812×375) viewport — sticky header + sticky tablist on themes page may stack awkwardly.
- Sources with no archive: spot-check that "archived" links don't render when `archive_url` is null. (`RT.archiveLink('')` returns "" so this should hold.)
- Try clicking very fast through the theme picker (open / click / open another / etc.) — make sure `localStorage` ends up matching the last selection.
- Open detail panel on `companies.html`, then navigate to another page via the nav — the panel should be torn down, not persist.

---

## Scroll-depth and weight metrics (added 2026-09-25)

Two numbers per page, tracked over time so "too much scrolling" is a measurement, not a feeling.

- **Screens of scroll** = page height / viewport height, read after the height stops changing (a JS-rendered page under-reports if read early). Run `scripts/uat-scroll-probe.js` in the browser on a page served from `docs/` at 1280×800 and 375×812. Budget: **10 screens desktop, 15 phone**. History: `data/metrics/uat-scroll.jsonl`.
- **First-load weight** = gzip bytes of HTML + local CSS/JS + the `data/*.json` files a page fetches, plus request count. `node scripts/site-metrics.js` (also runs in `npm test`; `--append` logs to `data/metrics/site-metrics.jsonl`). Budget: 260 KB gzip per page. It also fails on any broken internal link or missing local asset.

Baseline and result of the 2026-09-25 pass (desktop / phone screens): companies 12.4 / 11.0 → 4.8 / 5.0 (table capped at 25 rows, Show more / Show all); supply-chain 13.8 / 27.7 → 8.3 / 16.5 (sections collapsed by default, category tables wrapped so the page no longer overflows at 375 px). Still over budget: energy 14.3 / 32.8, policies (phone) 18.3, supply-chain (phone) 16.5. Backlog has the fixes.

Also run each pass:

- `python3 ~/Projects/coding-best-practices/tools/slopcheck.py docs/*.html docs/llms.txt` for writing tells, and the same tool with `--stdin` on any new record copy. Target: 0 FAIL. Remaining WARNs are long analytical sentences in `energy.html` and list lines in `llms.txt`.
- `python3 ~/Projects/coding-best-practices/tools/designcheck.py docs/` (36 WARN, all `web-font-import`; a design call, see backlog).
- Companies directory: Show more adds 25, Show all adds the rest, changing a filter resets to 25, and a `?focus=<id>` link still opens the panel for a company beyond row 25.


## 2026-09-24 — RFI and action-plan specificity

- Replaced headline-based RFI prioritization with three proposed missions, a common task record, and 32/20/12/7 evidence requests across the existing draft variants. Revision date, variant, and question ID identify responses.
- Action plan ties proposed six-site work to accountable leads, deliverables, deadlines, replication, installed cost, and buy/retest/stop decisions. Cohort size and deadlines are proposals; older background claims retain their stated research baseline.
- Verified both pages in Chrome at 375px and 1280px: no horizontal overflow, broken local anchors, or page errors. All four draft buttons render expected question counts. Letter print remains seven pages.
- Checks: npm test, npm run validate, npm run bake:check, git diff --check.


## 2026-09-24 — Executive-order conversion

- Converted the action-plan page into an unofficial nine-section executive-order draft. Preserved the URL and prior section anchors; updated navigation, RFI cross-link, metadata, README, and llms.txt.
- Added presidential authority language, signing-relative deadlines, agency responsibilities, voluntary non-Federal participation, appropriations limits, and standard general provisions. Drafting sources sit outside the operative text.
- Verified Chrome at 375px and 1280px, local anchors, RFI variant toggles, and page errors. Print: five pages of draft order plus one page of drafting notes. Full tests, validation, static rendering, and diff checks pass.

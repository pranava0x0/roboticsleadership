# UAT Baseline — Robotics Tracker

> Living UAT plan. Run the **Critical flows** every pass. **Exploration** is open territory — vary it each run. Update `last_tested` per section as you go. New bugs land in `issues.md`.

_Created: 2026-05-18_
_Last run: 2026-05-18_ (second pass — added agencies page)

---

## Project info

- **Stack:** vanilla HTML / CSS / JS + JSON data files. Zero runtime dependencies.
- **Dev server:** `node scripts/serve.js` → <http://localhost:8765>. Or via the Claude Code preview tool (`name: tracker` in `.claude/launch.json`).
- **Entry pages:** `docs/index.html`, `docs/companies.html`, `docs/policies.html`, `docs/agencies.html`, `docs/news.html`, `docs/themes.html`.
- **Shared:** `docs/assets/styles.css` + `docs/assets/app.js`.
- **Themes:** four — `caves`, `naked-sun`, `dawn` (default light), `robot-dreams` (default dark). See [DESIGN.md § 15](DESIGN.md).
- **Data:** `docs/data/{companies,policies,news,themes,sources}.json`. Validated by `scripts/validate.js`.

---

## Critical flows (run every pass)

These should always pass. If one regresses, log it as `critical` in `issues.md`.

1. **All six pages load without console errors.** Visit Dashboard / Companies / Policy / Agencies / News / Themes at the default theme (Dawn) and verify `preview_console_logs --level error` returns empty.
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
5. **Policies — three branch sections render.**
   - Congressional actions: 4 rows (HR 7334, HR 8189, OBBBA, CHIPS Act)
   - Executive actions: 5 rows
   - State incentives: 5 rows
   - Status filter "In effect" → 0 congressional + 4 executive (bills are never "in effect" — they get "Signed")
6. **News feed.**
   - 26 stories on initial load, sorted newest-first
   - Filter by company `figure-ai` → 3 stories
   - Filter by `figure-ai` + category `Funding` → 2 stories
   - Reset → 26
   - Hash deep-link (`news.html#apptronik-935m-feb2026`) scrolls the matching card into view
7. **Themes — tabs.**
   - 6 tabs render
   - Only 1 panel visible at a time (`document.querySelectorAll('[role="tabpanel"]:not([hidden])').length === 1`)
   - Click a tab → only that panel shows; `aria-selected` flips
   - Arrow Right / Left / Home / End keyboard nav moves focus across tabs
   - Hash on load activates the matching tab
   - **Hashchange post-load also activates the matching tab** (regression guard for the 2026-05-18 bug)
8. **Dashboard — archive-link parity with news.html.** For every card in `#recent-news`, if the underlying news record has `archive_url`, the card must render an `.archive-link`. Regression guard for the 2026-05-18 bug.
8a. **Agencies table renders.** 9 rows (OSTP, DOE, ARPA-E, DOC, NIST, NSF, NASA, Space Force, DARPA) with OSTP as the lead row; at least 40 external links; navigation marks `aria-current="page"`. At ≤540px viewport: page does not horizontally scroll (the nav internally scrolls instead).
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
| Policies | 2026-05-18 | Stable. Three branch tables. |
| News | 2026-05-18 | Stable. 16 of 26 records have archive_url. |
| Themes | 2026-05-18 | Stable post-fix. Hashchange regression worth keeping an eye on. |
| Agencies | 2026-05-18 | New. Pure HTML (no JSON data file); content is curator-written. Verify external links don't 404 on a quarterly cadence. |
| Theme picker | 2026-05-18 | Stable post-fix. The native `<details>` interaction is the source of past bugs — visually verify open/close each pass. |
| Archive links | 2026-05-18 | Surface on all 4 pages; verify on each in turn. |

---

## Known stable areas

- The four data files' shape + cross-references (covered by `scripts/validate.js`).
- The schema-validator's invariant set (status enums, type enums, required fields).
- The CI pages-deploy workflow.

## Known flaky / unstable areas

- **The news-card template is duplicated** between `index.html` and `news.html`. Any future change to the markup or the link footer must touch both, or the dashboard will silently drop the change (this is exactly how the 2026-05-18 archive-link bug happened). Backlog item: extract `renderNewsCard()` to `app.js`.
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

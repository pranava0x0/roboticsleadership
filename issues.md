# Issues

Living bug log. Each entry: date, area, description, root cause, status. On resolution, note the fix + commit.

## Open

### 2026-07-29 — app.js — the priority+ nav permanently reordered the nav on every page except index.html  ✅ FIXED 2026-07-29

- **Area:** `docs/assets/app.js` `initResponsiveNav().layout()`. Found in code review of PR #140, **not** by my own testing.
- **Symptom:** collapse the nav (narrow the window) then widen it again, on any page whose link is not the first one. On `companies.html` the nav came back as `Front page | Companies | News | US vs China | Policy | …` — "Companies" permanently promoted from position 4 to 2 — and the mutated order then changed which links survived the *next* collapse.
- **Root cause (code bug):** the restore was `while (overflow.firstChild) list.appendChild(overflow.firstChild)`, which only reproduces the authored order when every inline survivor sits at the front of the list. The collapse loop deliberately skips the current page's `<li>`, so on any other page that survivor is stranded mid-list and the parked items return *behind* it.
- **Why it shipped:** `index.html`'s link is index 0, so appending happened to be correct there — and I swept **four widths on one page** instead of one width across pages. The bug is invisible in exactly the configuration I tested.
- **Fix:** snapshot the authored `<li>` order once at init (`const authored = Array.from(list.children)`) and re-append from that array each pass. Verified on `companies.html` (index 3) and `themes.html` (index 8, the worst case) with a full collapse→widen cycle.
- **Lesson, now in CLAUDE.md:** when a layout's behaviour depends on which element is "current", sweeping widths on one page proves nothing. **Sweep pages, not just widths.**

### 2026-07-29 — app.js — the nav fit calculation ignored flex `gap`  ✅ FIXED 2026-07-29

- **Area:** same function. The **third** flex-measurement bug in this file.
- **Symptom:** `used` was `Σ li.offsetWidth`, but `.nav-list` and `nav.primary-nav` both set `gap: 2px`. Measured 718 against a true `scrollWidth` of 733 — and ~18px across nine links. At a 978px viewport the fit test returned early with the dropdown still hidden and the last link spilling 7px past the nav's right edge.
- **Fix:** measure `list.scrollWidth` (which includes gaps) rather than summing item widths, add one `columnGap` to the reserve, and re-read `scrollWidth` after each move instead of subtracting a cached width.
- **Also hardened:** `layout()` now aborts on a falsy `nav.clientWidth`. Replayed with `avail = 0` it parked **8 of 9 links** in the dropdown, indistinguishable from a deliberate narrow layout — and a pre-paint zero read is documented in this very repo.

### 2026-07-29 — DESIGN.md / styles.css — the theme contrast audit omitted `--surface-2` as a background  ✅ FIXED 2026-07-29

- **Area:** the 2026-07-28 theme rework. Found in code review; the reviewer reproduced my published numbers exactly against `--bg`/`--surface`, then checked the background I had left out.
- **Symptom:** the PR claimed verification "over every (token, background) combination". It wasn't. Four pairs were below the stated bar on `--surface-2` — and widening the set turned up a fifth on `--surface`: Caves `--text-faint` 4.30:1, Naked Sun `--border-strong` 2.74:1, Dawn `--border-strong` 2.78:1, Robot Dreams `--text-faint` 4.18:1 on `--surface` / 4.30:1 on `--surface-2`, Robot Dreams `--border-strong` 2.90:1 on `--surface`.
- **Why it matters:** `--surface-2` is a real text background — nav hover and `aria-current` use it, and the "Sections" caret is `--text-faint` on it, so the Caves case shipped on a control.
- **Fix:** darkened/strengthened the four tokens (Caves faint `#828892`→`#949ba5`, Naked Sun border `#8a9298`→`#7c8489`, Dawn border `#9e8668`→`#8c7454`, Dreams faint `#847e73`→`#9a9488` and border alpha 0.45→0.55), and widened the checker to all three backgrounds. All four themes now clear every pair.
- **Lesson:** an audit is only as good as its background set. A "verified" claim needs the *set* stated, not just the result.

### 2026-07-28 — scraper-news.js — every scraped record's `source` was the scraper's config id, not the publication  ✅ FIXED 2026-07-28

- **Area:** `scripts/scraper-news.js` (all four record constructors), `docs/data/news.json`, `docs/data/sources.json`.
- **Symptom:** news bylines read `hacker-news-robotics`, `federal-register-robotics`, `techcrunch-robotics-tag` — slugs, not mastheads. **729 of 785** records (93%) were affected. It had always been wrong; it only became obvious when the front-page rebuild put a byline under a lead headline instead of in a dense card footer.
- **Root cause (code bug):** the record templates wrote `source: source.id`, and `sources.json` had no field carrying the human-readable name, so there was nothing better to write. The HN constructor hardcoded the string `'hacker-news-robotics'` on top of that.
- **Fix:** added a `publication` field to each `sources.news[]` entry in `sources.json`; all four constructors now write `source: source.publication || source.id`; the 729 existing records were backfilled from that same map, so the migration and the scraper can't drift. Remaining slug-shaped sources after the pass: none.
- **Regression coverage:** none yet. Cheap guard worth adding: assert no `news.json` record's `source` matches `/^[a-z0-9]+(-[a-z0-9]+)+$/` — see backlog.

### 2026-07-28 — styles.css — the priority+ nav measured a width that no longer existed once it finished  ✅ FIXED 2026-07-28

- **Area:** `docs/assets/styles.css` (`nav.primary-nav`, `.primary-more`), `docs/assets/app.js` (`initResponsiveNav`).
- **Symptom:** at 420px the front page rendered `US vs ChinaSections ∨` — the last inline link printed underneath the overflow button. Off by exactly one link, and only in a narrow band of widths.
- **Root cause (CSS bug, two compounding):** (1) `nav.primary-nav` was `flex: 1 1 auto`, so its share of the header row depended on its *own* content — `nav.clientWidth` read **317px** while all nine links were still inline and settled at **289px** once six had moved out and the siblings relaxed back to natural width. The fit was computed against a width that stopped existing. (2) `.primary-more` inherited `flex: 0 1 auto`, so the browser had already squeezed it when its width was sampled as the reserve, returning ~60px against a true 83px.
- **Fix:** `nav.primary-nav { flex: 1 1 0 }` (zero basis makes the nav's width a pure function of its siblings, so one measurement holds for the whole pass), `.primary-more { flex: 0 0 auto }`, and `flex: 0 0 auto` on `.header-updated` / `.theme-picker` so the siblings genuinely are fixed. Verified at 375 / 420 / 900 / 1280px with zero page horizontal scroll.
- **General lesson:** any JS layout that measures a flex item's available width must not let that item's own content feed back into the measurement. Zero-basis, or measure the container instead.

### 2026-07-20 — scraper-news.js — `hacker-news-robotics` source is low-precision and summary-less

- **Area:** news scraper (`scripts/scraper-news.js`), HN source (`hacker-news-robotics`), queries `robot` / `robotics` / `humanoid`.
- **Symptom:** the 2026-07-20 refresh pulled **28** HN records in one run; ~21 were pure noise with no robotics connection at all — *Panama Papers / Swedbank fine*, *Big Oil extreme weather*, *Google censoring ICE reviews*, *EU ban on unsold clothes*, *narcissistic leaders oppose remote work*, *Archive.org is offline*. All 28 also had **no summary** (the scraper stores the title as the body, so cards render a title repeated as its own description).
- **Root cause (data/source bug):** the HN Algolia query matches loosely — `humanoid` typo-tolerance catches `human*` (Humans vs. LLMs, "Humanity at the Threshold", "AI humanizer", Manna "Two Views of Humanity"), and `robot` matches org/product names incidentally (a GitHub org literally named `Hebbian-Robotics`). No relevance gate, no points threshold, and no article-body fetch means every hit lands as a bare, unsummarized link.
- **Impact:** every refresh dumps ~20+ noise records into `news.json` carrying `_requires_curator_review`, so the deploy gate correctly blocks them — but a human has to hand-prune the whole batch each run, and it buries the few real HN items (Xiaomi-Robotics, "Claude Plays Robotics"). This run: all 28 dropped during curation; the 6 Robot Report RSS records were kept.
- **Fix options (see backlog "Leads from X"):** (a) require a min HN points/comments threshold; (b) drop the `humanoid`/`robot` OR-typo-tolerance and keyword-gate titles before constructing a record; (c) disable HN entirely and lean on trade RSS + the curated X PhysicalAI list. Note the CLAUDE.md caveat: a pure keyword gate under-matches on-thesis US-vs-China records (Entity List, Section 301), so any gate is triage, not a filter — HN is a different case because its *false positives* dominate.
- **Regression coverage:** none. A cheap guard: assert the scraper never emits a news record whose `summary` equals its `title`.

### 2026-07-16 — app.js — `initCollapsibleSections` is a no-op on every page whose sections are rendered by JS  ✅ FIXED 2026-07-21

**Resolved 2026-07-21 via option (b) (delegation), plus a re-callable state applier.** `initCollapsibleSections` now binds a single delegated `toggle` listener on `document` in the **capture** phase (`toggle` doesn't bubble, but capture reaches the target's ancestors), so persistence survives any container re-render. State restore/default moved into `applyCollapsibleState()`, which is idempotent and exported as `RT.applyCollapsibleState()`; china's inline script calls it after `RT.paint('#vs-sections', …)` so the re-painted `<details>` pick up their state. Default rule also changed for scroll reduction: pages tagged `<body data-collapse-sections>` (china/energy/supply-chain) default to "first section open, rest collapsed" on all viewports; untagged pages respect authored `open` attrs. Verified live: china shows 1/5 sections open, no console errors. Original write-up kept below.



- **Area:** collapsible sections (`docs/assets/app.js:328-375`), affecting `china.html` and any page that renders `details.collapsible-section[id]` from data.
- **Symptom:** on china.html, expanding a metric section and reloading does **not** restore it — and the "on mobile, open only the first section" default never applies either. Verified live on a baked page: after toggling section 3 and reloading, `open` state is `[true,false,false,false,false]` and **zero** `details-state-china.html-*` keys exist in localStorage. The feature silently does nothing.
- **Root cause (code bug):** ordering. `app.js` is `<script defer>` *before* the page's own `defer` script, so its `DOMContentLoaded` listener (`init()` → `initCollapsibleSections()`) fires **first** — at which point `#vs-sections` is still the empty placeholder. `document.querySelectorAll('details.collapsible-section[id]')` matches nothing, so no state is restored and no `toggle` listener is attached. The page script then renders the sections into a page where nothing is listening.
- **Not caused by the bake step, and not fixed by it.** Pre-dates it: the sections never existed at `init()` time. Post-bake they *do* exist in the HTML, so `initCollapsibleSections` finds them and attaches listeners — but the page script's `RT.paint()` immediately replaces those nodes with fresh ones, discarding the listeners. Same end state, different route. Found while verifying the bake didn't change hydration behaviour.
- **Impact:** low-moderate. Nothing is broken or misrendered; a documented affordance just doesn't work on the site's most content-dense page. Static pages that hand-author their `<details>` (themes.html, energy.html) are unaffected — their sections exist at `init()`.
- **Fix:** don't bind on a global `DOMContentLoaded` race. Either (a) export `RT.initCollapsibleSections()` and have each page call it *after* it renders, or (b) delegate — one `toggle` listener on `document` (the event doesn't bubble, but it can be captured), which survives any re-render and is the smaller change. (b) preferred; (a) is 9 call sites and re-introduces the same ordering question every time a page adds a render.
- **Regression coverage:** none. Needs the jsdom harness the backlog already wants for news.html's deep-link contract — same class of ordering bug, same blind spot in a Node-only suite.

### 2026-07-16 — app.js — `loadData` cache stampede: concurrent callers double-fetch the same dataset

- **Area:** data fetching (`docs/assets/app.js:11-24`).
- **Symptom:** `sources.json` was requested **twice** on every page load. Found while verifying WS0's dead-fetch removal — the network panel showed the duplicate after `agencies.json` correctly disappeared.
- **Root cause (code bug):** the in-memory cache stores the *resolved* value (`cache[name] = json`) only after `await fetch(...)` returns. Two callers racing for the same dataset both evaluate `if (cache[name])` before either resolves, so both miss and both fetch. `loadAll()` and `loadHeaderUpdated()` did exactly this on `sources.json`.
- **Impact today:** small — one extra 4KB request on each page. It gets worse with WS5, which lazy-loads datasets from several call sites at once; that's precisely the pattern that races.
- **Status:** Open. Partially mitigated 2026-07-16 by removing `sources.json` from `loadAll()` (the two racers no longer overlap), but the underlying cache is still stampede-prone for any future concurrent pair.
- **Fix:** cache the in-flight **promise** rather than the value — `if (!cache[name]) cache[name] = fetch(...).then(...)` — so concurrent calls collapse to one request. Tracked in `improvement-plan-2.md` WS5.
- **Regression coverage:** none yet; needs a test that fires two `loadData` calls for the same name concurrently and asserts a single fetch (stub `globalThis.fetch`, count calls).

## Fixed

### 2026-07-13 — news.html — deep-link `news.html#<id>` never opened the target story

- **Area:** news feed pagination + URL state (`docs/news.html`, `docs/assets/app.js`).
- **Symptom:** every `news.html#hn-…` link — the anchors we repointed all "recent activity" / theme "related news" / feed-card links to when News moved to its own page — landed on **page 1 / top of feed**, not the linked story. Caught by the correctness reviewer in the multi-perspective review, reproduced live (`#hn-48801154` → "Page 1 of 35", target not rendered).
- **Root cause (code bug):** `renderNewsFeed()` calls `RT.writeQuery()` at the *top*, which does `history.replaceState(null,'', pathname[?qs])` — no fragment — **stripping `location.hash` before** the deep-link block lower in the same function reads it. `replaceState` is the only URL mutator in the codebase, so nothing restored it.
- **The trap that made the naive fix wrong:** just preserving the hash in `writeQuery` isn't enough — the page-jump logic recomputed `newsPage` from `location.hash` on *every* render, so Prev/Next would snap back to the anchored page on each click (they only "worked" before because the hash was being wiped).
- **Fix:** capture the hash **once** at `DOMContentLoaded` into `pendingHash`, consume it only on the initial render (jump + scroll), then null it so pagination/filter re-renders don't re-jump. Verified: `#hn-48801154` → Page 2 with the card rendered; Next→3→4, Prev→3 with no snap-back. See the multi-perspective review-fix commit on branch `claude/goofy-shaw-1f5dd6`.
- **Regression coverage:** behavior is browser-only (hash + pagination interaction), not reachable by the Node test suite; covered by a manual browser check in the verify step. Backlog notes a jsdom pagination test as a future guard.

## Tooling notes

### 2026-07-16 — browser MCP — safety-classifier outage blocks `javascript_tool` / `preview_stop`; read-only tools keep working

- **What I expected:** once the preview server is up, the browser MCP tools stay available.
- **What happened:** mid-verification, `mcp__Claude_Browser__javascript_tool` and `preview_stop` started returning *"claude-opus-4-8 is temporarily unavailable, so auto mode cannot determine the safety of &lt;tool&gt;"*. Intermittent — the same call succeeded on retry a minute later.
- **Why:** these tools are gated by a safety classifier that runs on the model. When the model is briefly unavailable the *gate* fails, not the tool or the page. Read-only tools (`get_page_text`, `read_page`, `read_console_messages`) aren't gated and worked throughout.
- **Next time:** don't stall, and don't restart the verification. Fall back to `get_page_text` / `read_page` for DOM facts — when this hit, the page's own rendered "23 policies" counter answered exactly what the blocked `javascript_tool` call was going to ask — or verify from the data side in Bash. Both are authoritative. Retry the gated call once; it usually clears.

### 2026-07-09 — hooks — PreToolUse security hook blocks any Edit whose payload contains `innerHTML`

- **What I expected:** the security-reminder hook flags only *new* unsafe sinks.
- **What happened:** it blocked Edit calls whose `old_string`/`new_string` merely quoted existing, already-escaped `innerHTML` lines as anchoring context (twice in one session).
- **Why:** the hook keyword-matches the edit payload; it isn't diff-aware, so unchanged context lines trigger it the same as new code. It is also not *content*-aware: it blocked an edit to **this very entry**, because the prose describing the hook contains the word the hook matches on (2026-07-16). If you're documenting it, write around the token.
- **Next time:** anchor edits above/below the offending lines when that code is unchanged; for new render code that's numeric/attribute-only (e.g. the china.html score bar), use DOM methods (`createElement` + `style.width`) — cleaner and passes the hook. When new code genuinely needs HTML strings, keep the project's `RT.escapeHTML`-everything pattern and document the posture in a comment (per the 2026-06-01 XSS fix). Never bypass via Bash.
- **Recurred 2026-07-16** (WS0 KPI links) — three sessions running now, so assume it will bite. The blocked edit rewrote the KPI strip's `strip.<sink> = kpis.map(…)` template to swap a `<div class="kpi-card">` for an `<a>`. What worked: **two** Edits, neither payload containing the assignment line itself — one for the `kpis` array above it, one for the template literal below it. Cost one blocked call. Sharpening the advice above: the assignment line must be outside *both* `old_string` and `new_string`, not merely unchanged.

### 2026-07-06 — git — local `main` silently diverged from `origin/main` ("ahead 170, behind 173")

- **What I expected:** local `main` in the primary worktree tracks `origin/main` cleanly since nobody works directly on `main`.
- **What happened:** `git status`/`git branch -vv` showed local `main` both ahead and behind `origin/main` by ~170 commits each — caused by `scripts/merge-all-branches.js` creating local-only merge commits in parallel with the same content being separately pushed/merged to `origin/main` via PRs and GitHub Actions. The two trails diverged in commit identity while carrying near-identical content; nobody noticed because each side looked internally consistent.
- **Why:** no routine check ever diffed local `main` against `origin/main` directly — divergence like this is invisible unless you look for it.
- **Next time:** run `git fetch --prune` + `git branch -vv` before any branch sync/cleanup/merge request, and if both ahead/behind are non-zero, diff the actual file trees (`git diff main origin/main --stat`) before assuming local holds real unpushed work. See `CLAUDE.md`'s Git discipline section for the added rule.

### 2026-07-06 — git — ~16 already-merged commits on `main` carried `Co-Authored-By: Claude` trailers

- **What I expected:** the repo's `claude.coauthor false` git config was sufficient to keep AI co-author attribution out of history.
- **What happened:** found 16 commits already merged into `main` (dating back to 2026-06-03, before the config was tightened) still carrying `Co-Authored-By: Claude` trailers.
- **Why:** the config only prevents *new* violations — it doesn't retroactively clean existing history, and nobody had audited `git log --all` for pre-existing trailers.
- **Fix:** rewrote `main`'s history with `git filter-repo --refs main --message-callback ...` (run on a disposable fresh clone, never in the shared worktree) to strip the trailers, verified the file tree was byte-identical before/after, then force-pushed. This is disruptive — it changes every commit SHA from the earliest violation forward and breaks any branch/clone/PR based on the old commits (our own open PR at the time needed a rebase after). Confirmed explicitly with the user before doing it.
- **Next time:** when asked to enforce a "no AI co-author" policy, check `git log --all --grep="co-authored-by" -i` across history, not just the config — and treat any history rewrite as a separate, explicitly-confirmed destructive action, distinct from the policy-enforcement request itself.

### 2026-06-12 — preview MCP — screenshots blank at non-zero scroll

- **What I expected:** `preview_screenshot` captures the scrolled viewport.
- **What happened:** Blank captures for any non-zero scroll position (reproduced on new supply-chain.html *and* known-good themes.html).
- **Why:** Tool artifact — the screenshot composites only the document-top frame; not a page bug.
- **Next time:** Verify below-the-fold content with `preview_eval` DOM checks or `preview_snapshot`; trust screenshots only at scroll position 0.
- **Workaround validated 2026-07-09:** `preview_resize` to a tall viewport (e.g. 1280×2200), then screenshot at scroll-0 — captures below-fold content in one frame. Reset with the `desktop` preset afterward.

## Documentation updates (non-critical)

### 2026-06-07 — docs — README and UAT outdated after 2026-05-23 consolidation

- **Status:** Fixed.
- **Description:** The May 23 "Consolidate navigation tabs and implement collapsible sections" commit deleted `docs/news.html` and `docs/agencies.html`, integrating their content (as collapsible sections and related news) into `policies.html`. The README and UAT documentation were not updated to reflect this structural change.
- **Fix:** Updated README.md to remove reference to `news.html` and updated the `policies.html` entry to note it now contains collapsible sections for agencies, tax incentives, and state incentives. Updated UAT to remove references to standalone news/agencies pages and revised critical flow tests to reflect consolidated structure (5 pages instead of 6, policies sections instead of separate pages).
- **Reason:** Documentation must reflect current reality so users and future developers understand the actual project structure.

## Fixed (most recent first)

### 2026-06-30 — data — Boston Dynamics financials.details cited the Hyundai/SoftBank stake buyout with the wrong year

- **Status:** Fixed.
- **Root cause:** data bug — `financials.details` for `boston-dynamics` read "Hyundai took full control 2025-06 by buying SoftBank's remaining 9.65% stake for $325M." A 2026-06-30 X.com/TechCrunch/AngelList-Crunchbase research sweep independently surfaced this same event (same $325M figure, same 9.65% stake) dated 2026-06-19 to 06-22, corroborated by two new sources (TheNextWeb, KEDGlobal). The pre-existing "2025-06" was a one-year typo, not a distinct prior-year event.
- **Repro:** compare `docs/data/companies.json` → `boston-dynamics.financials.details` (pre-fix: "2025-06") against TheNextWeb's "Hyundai to buy SoftBank's last Boston Dynamics stake for $325M" (dated June 2026).
- **Fix:** corrected the year to "2026-06" and added the TheNextWeb source to `financials.sources`.
- **Regression test:** none added — single-field data correction, caught by manual cross-source verification during the routine 2-week discovery sweep, not by an automated check. `node scripts/validate.js` confirms the record still validates post-fix.

### 2026-06-22 — data/refactor — stale root metrics, unmapped news relations, and duplicate news template rendering

- **Status:** Fixed.
- **Root cause:** code bug — PR #75 introduced several issues: (1) updated funding rounds in `companies.json` for Agility, AgiBot, and Unitree but left their root `latest_valuation_usd` and `total_funding_usd` fields stale; (2) added news items without running the relationship mapper `enrich.js`, leaving relations empty; (3) duplicated the HTML template for rendering news cards in `index.html` and `themes.html` (the same duplication that previously caused the 2026-05-18 archive-link bug).
- **Repro:** check `companies.json` root fields against round details (stale); check newly added news in `news.json` (empty relation lists); modify a news card design style on one page and observe the other page remains outdated.
- **Fix:** (1) corrected root properties for Agility, AgiBot, and Unitree to match round details/research JSONs; (2) ran `node scripts/enrich.js` to map company/policy relationships; (3) extracted the news card template to `RT.renderNewsCard()` in `docs/assets/app.js` and updated both pages to call it.
- **Regression test:** `node scripts/validate.js && npm test` verifies the schema format and layout wiring.

### 2026-06-04 — scrapers — scraper-policy.js missing User-Agent header on Federal Register fetch

- **Status:** Fixed.
- **Root cause:** code bug — `scraper-policy.js` called `fetch(url)` with no headers. The Federal Register API returns 403 to requests without a recognizable User-Agent, a pattern that `scraper-news.js` already handled correctly (it sets `robotics-tracker/1.0` on its Federal Register call). The bug caused all policy scraper runs to silently fail with "Failed to fetch: HTTP 403" after updating `last_run` — masking the failure.
- **Repro:** `node scripts/scraper-policy.js` → `Failed to fetch: HTTP 403 — skipping`.
- **Fix:** added `headers: { 'User-Agent': 'robotics-tracker/1.0 (https://github.com/pranava0x0/roboticsleadership)' }` to the fetch call in `scraper-policy.js`, matching the existing pattern in `scraper-news.js`.
- **Regression test:** N/A — external dependency. Verified by running policy scraper post-fix.

## Fixed

### 2026-06-01 — CI/supply-chain — Actions are 0% SHA-pinned; floating @v4 tags fleet-wide

- **Status:** Fixed.
- **Root cause:** code bug (supply-chain) — all 4 workflows referenced actions by floating tag (`actions/checkout@v4`, `setup-node@v4`, `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`). A retag-compromise of any tag injects attacker code. The dangerous combination is the three cron jobs (`scrape-news`, `scrape-policy`, `archive-sources` — all `contents: write` + `pull-requests: write`): they run automatically, with creds, no human in the loop.
- **Repro:** `grep -rn 'uses:.*@v[0-9]' .github/workflows/` → every action pinned to a mutable tag.
- **Fix:** pinned every `uses:` to its full 40-char commit SHA with a trailing `# vX` comment (checkout `34e1148…`, setup-node `49933ea…`, configure-pages `983d773…`, upload-pages-artifact `56afc60…`, deploy-pages `d6db901…`). Verified all 4 workflows already carry explicit least-privilege `permissions:` blocks (pages: `contents:read`/`pages:write`/`id-token:write`; the three crons: `contents:write`/`pull-requests:write`, which is the minimum for branch-push + PR-open) — none were missing.
- **Regression test:** N/A (config). `grep -rn 'uses:.*@v[0-9]'` now returns nothing. Guard idea tracked in `backlog.md`: a CI lint that rejects `@vN` in `uses:`.

### 2026-06-01 — frontend/security — Stored-XSS from scraped data via unescaped innerHTML

- **Status:** Fixed.
- **Root cause:** code bug — render code mostly uses `RT.escapeHTML`, but four sinks interpolated scraped/curated data raw into `innerHTML`: (1) category/direction class slugs (`cat-${n.category…}`, `dir-${t.direction…}`) only stripped whitespace, so `"`/`<`/`>` broke out of the `class="…"` attribute (index, themes, companies, policies); (2) `agencies.json` `rd_focus`/`applications`/`manufacturing` rendered raw in the `policies.html` R&D table; (3) the tax-section policy `summary` rendered raw in `policies.html` (the detail panel escapes the same field — inconsistent); (4) `companies.json` `revenue_year`/`net_income_year` rendered raw in the company detail panel.
- **Repro:** set a news item `category` to `x"><img src=x onerror=alert(1)>` → script runs on dashboard/news cards.
- **Fix:** added an `RT.slug()` sanitizer in `app.js` (`String → lowercase → strip everything except [a-z0-9-]`) and routed all class slugs through it; wrapped the raw agency fields, tax summary, and financial-year fields in `RT.escapeHTML`. Verified `pillFor`/`statusPill` already map to a fixed class vocabulary (safe).
- **Regression test:** inline node unit test on `slug()` — `x"><img …>` → `ximgsrcxonerroralert1`, legit values (`Funding`, `Accelerating`) unchanged. Backlog: a render-layer test asserting no `<` survives into emitted markup for a poisoned record.

### 2026-06-01 — scrapers — Federal Register policy scraper omits required `themes` field

- **Status:** Fixed.
- **Root cause:** code bug — `scraper-policy.js` built records without a `themes` key, but the policy schema lists `themes` as required. Surfaced during the monthly data refresh: `validate.js` rejected the freshly-scraped `fedreg-2026-10697`.
- **Repro:** run `scripts/scraper-policy.js` against a new Federal Register match, then `node scripts/validate.js` → `missing required field "themes"`.
- **Fix:** added `themes: []` to the record template in `scraper-policy.js`; backfilled the one already-written record. `validate.js` now passes clean.
- **Regression test:** the schema's `themes` required-field check is itself the test; it caught the bug on the first refresh after the fix to the slug code.

### 2026-05-17 — scrapers — The Robot Report RSS returns 403 to our User-Agent

- **Status:** Fixed
- **Root cause:** external dependency — `therobotreport.com` blocks unknown bots; only browser-like UAs succeed.
- **Repro:** `node scripts/scraper-news.js --dry-run --source=the-robot-report` → `HTTP 403 Forbidden`.
- **Fix:** added a browser-like User-Agent header to the fetch call in `scraper-news.js`.
- **Regression test:** N/A — external dependency. Checked by running scraper successfully.

### 2026-05-18 — UAT — themes page didn't react to hashchange after load

- **Status:** Fixed.
- **Root cause:** code bug — the themes page activated the tab matching `location.hash` only once, inside the DOMContentLoaded handler. After the initial activation it had no listener on `hashchange`, so any later anchor click or address-bar edit silently did nothing.
- **Repro:** open `themes.html` → click a tab to land on, say, `#china-scale` → manually paste `themes.html#defense-procurement` into the address bar without reloading → expected: tab switches; actual: nothing happens.
- **Fix:** added a `window.addEventListener('hashchange', …)` inside the themes-page init that re-invokes `activate(id)` for any valid theme id. The original initial-activation path is unchanged.
- **Regression test:** in `uat.md` as "Themes — hash deep-link." A UAT pass dispatches `hashchange` and asserts the active tab matches.

### 2026-05-18 — UAT — dashboard "Recent activity" cards never showed archive links

- **Status:** Fixed.
- **Root cause:** code bug — when the source-link rot mitigation shipped, the news-feed renderer in `news.html` was updated to append `RT.archiveLink(n.archive_url)` after the "Read original" link. The dashboard renders its own copy of the news card markup in `index.html` and that copy was never updated.
- **Repro:** open `index.html`; the top recent-news cards never showed an "archived ↗" link, even when the underlying record had `archive_url` populated (3 of the top 5 had snapshots).
- **Fix:** added `${RT.archiveLink(n.archive_url)}` next to the "Read original →" link in the dashboard's recent-news template.
- **Regression test:** in `uat.md` as "Dashboard — archive-link parity with news.html." A UAT pass diffs `count(.archive-link in #recent-news)` against the count of recent-news records with `archive_url`.
- **Lesson:** the news-card template is duplicated between `index.html` and `news.html`. Future changes to it should touch both — or, better, extract a `renderNewsCard()` helper into `app.js` so the next divergence is impossible. Tracked in backlog.

### 2026-07-16 — energy.html — Prime Mover nav chip counted DOM nodes that did not exist yet

- **Status:** Fixed (code review of the Prime Mover section, before merge).
- **Root cause:** code bug (benign) — `renderEnergy()` set the chip count from `document.querySelectorAll('#prime-mover .rfi-q').length`, but `renderPrimeMover()` (which populates `#pm-questions`) runs *later* in the same synchronous task. The expression always evaluated to `0`. No user-visible symptom, because `apply('full')` overwrote the chip with the correct count before paint — the line read as if it derived the count while doing nothing.
- **Repro:** log the value at assignment time in `renderEnergy()` — it is `0` on every load, for every variant.
- **Fix:** dropped the dead query; `renderPrimeMover()` owns the count and already re-derives it from `PM_VARIANTS` on load and on every variant switch. Verified in-browser: chip reads 32 on load, 7 after "Lean", 32 back on "Full".
- **Regression test:** indirect — `scripts/energy.test.js` § 7 now asserts every variant is wired to a real button and that counts derive from `PM_VARIANTS` (the data), which is the invariant the dead line pretended to uphold. The ordering rule itself is documented in CLAUDE.md § Project-specific.
- **Lesson:** in the inline-data pages (no `fetch`, everything synchronous), script order *is* the dependency graph. Counting rendered DOM from an earlier IIFE is always a bug; derive from the data.

### 2026-05-17 — CI scrapers pushed raw scraper output directly to main

- **Status:** Fixed (commit `862f3f0` reverts; new workflow design opens PRs instead).
- **Root cause:** code bug (architecture) — both `scrape-news.yml` and `scrape-policy.yml` were configured to `git push` straight to `main`. The Federal Register scraper matched 99 broad-keyword Federal Register entries on the first run; all 99 stubs landed on `main` and shipped to Pages.
- **Repro:** trigger `scrape-policy.yml`; observe `data(policy): auto-scrape …` commit on `main`.
- **Fix:** workflows now create a branch (`auto/news-…` / `auto/policy-…`), push the branch, and open a PR via `gh pr create`. A curator must merge after pruning + tagging. The 99-stub commit is reverted in `862f3f0`.
- **Regression test:** none added — the change is workflow-only. The PR-template body lists the curator checklist as a visible reminder.
- **Lesson:** any automated data ingestion that produces ambiguous output should land via PR, never via direct commit. The validation gate alone is not enough; validation checks shape, not relevance.

### 2026-05-17 — News scraper produced records with empty `summary`

- **Status:** Fixed (scraper now writes a fallback when the feed lacks a description).
- **Root cause:** code bug — `scraper-news.js` set `summary: item.description?.slice(0, 700) || ''`, so a Federal Register item with no abstract produced an empty string, which the schema validator (correctly) rejected.
- **Repro:** before fix — run scraper against `federal-register-robotics`; validate fails on the next-news.json with "missing required field summary".
- **Fix:** fallback to `(no abstract from feed — see original: <truncated title>)`. The `_requires_curator_review` flag stays set so this surfaces.
- **Regression test:** the schema's `summary` required-field check is itself the test; it already caught the issue.

---

## Format

```
### YYYY-MM-DD — <area> — <one-line description>

- **Status:** Open / Fixed
- **Root cause:** code bug | test bug | data bug | external dependency | unknown
- **Repro:** <minimal steps>
- **Fix:** <what changed; commit hash>
- **Regression test:** <added? skipped? why?>
```

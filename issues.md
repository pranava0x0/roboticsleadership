# Issues

Living bug log. Each entry: date, area, description, root cause, status. On resolution, note the fix + commit.

## Open

No open issues.

## Tooling notes

### 2026-06-12 — preview MCP — screenshots blank at non-zero scroll

- **What I expected:** `preview_screenshot` captures the scrolled viewport.
- **What happened:** Blank captures for any non-zero scroll position (reproduced on new supply-chain.html *and* known-good themes.html).
- **Why:** Tool artifact — the screenshot composites only the document-top frame; not a page bug.
- **Next time:** Verify below-the-fold content with `preview_eval` DOM checks or `preview_snapshot`; trust screenshots only at scroll position 0.

## Documentation updates (non-critical)

### 2026-06-07 — docs — README and UAT outdated after 2026-05-23 consolidation

- **Status:** Fixed.
- **Description:** The May 23 "Consolidate navigation tabs and implement collapsible sections" commit deleted `docs/news.html` and `docs/agencies.html`, integrating their content (as collapsible sections and related news) into `policies.html`. The README and UAT documentation were not updated to reflect this structural change.
- **Fix:** Updated README.md to remove reference to `news.html` and updated the `policies.html` entry to note it now contains collapsible sections for agencies, tax incentives, and state incentives. Updated UAT to remove references to standalone news/agencies pages and revised critical flow tests to reflect consolidated structure (5 pages instead of 6, policies sections instead of separate pages).
- **Reason:** Documentation must reflect current reality so users and future developers understand the actual project structure.

## Fixed (most recent first)

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

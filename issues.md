# Issues

Living bug log. Each entry: date, area, description, root cause, status. On resolution, note the fix + commit.

## Open

### 2026-05-17 — scrapers — The Robot Report RSS returns 403 to our User-Agent

- **Status:** Open
- **Root cause:** external dependency — `therobotreport.com` blocks unknown bots; only browser-like UAs succeed.
- **Repro:** `node scripts/scraper-news.js --dry-run --source=the-robot-report` → `HTTP 403 Forbidden`.
- **Workaround:** disable in `docs/data/sources.json` or manually curate top stories from this source.
- **Next step:** decide between (a) accept 403 and rely on Federal Register / IEEE Spectrum / TechCrunch, (b) rotate UA to a browser-string (some sites enforce on UA *and* on rate limit, so this can still trip), (c) substitute another robotics-news feed.
- **Regression test:** N/A — external dependency. Track via the `last_run` field in `sources.json`.

## Fixed

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

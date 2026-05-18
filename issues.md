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

_None yet._

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

# data-refresh — Robotics Tracker Data & Docs Sync

Automates the full data refresh, documentation sync, testing, and PR merge workflow for the Robotics Tracker.

## What it does

1. **Data validation** — Runs `scripts/validate.js` to verify all data files
2. **Data scraping** (optional) — Runs news & policy scrapers if network is available; gracefully skips if blocked
3. **Documentation sync** — Checks for drift between README/UAT and actual codebase structure; flags inconsistencies
4. **Testing** — Verifies all pages load, navigation is consistent, cross-references validate
5. **CI lint** — Runs `scripts/lint-actions.js` to ensure GitHub Actions are SHA-pinned
6. **Commit & PR** — Creates a commit with standard message, opens a draft PR, merges to main on confirmation

## Usage

```bash
# Full workflow (interactive; asks before merge)
/data-refresh

# Dry-run mode (validate + test, no commits)
/data-refresh --dry-run

# Skip scraping (validation + doc sync + tests only)
/data-refresh --no-scrape

# Auto-merge (runs full workflow, merges PR without prompting)
/data-refresh --auto-merge

# Just scrapers (data refresh only, skip everything else)
/data-refresh --scrape-only
```

## Prerequisites

- Node.js 18+
- Git configured (for commits)
- Network access to external data sources (optional; workflow degrades gracefully if unavailable)

## Workflow steps

### 1. Validation
```bash
node scripts/validate.js
```
Checks JSON schema, required fields, enum validity, cross-references.

### 2. Scraping (if --no-scrape is not set)
```bash
node scripts/scraper-news.js   # Federal Register, IEEE Spectrum, TechCrunch, Reddit, HN
node scripts/scraper-policy.js # Federal Register robotics rules
```
Appends new items to `docs/data/news.json` and `docs/data/policies.json`. Gracefully skips if network blocks.

### 3. Documentation sync check
- Verify README.md lists all pages in `docs/`
- Verify UAT.md covers all pages + critical flows
- Flag any pages that exist but aren't in docs
- Flag any missing required fields in documentation

### 4. Testing
```bash
# All pages load
for page in index companies policies states themes; do
  curl -s http://localhost:8765/${page}.html | grep -q '<main' || fail
done

# Data loads
curl -s http://localhost:8765/data/{companies,news,policies,themes}.json

# Navigation consistent
# Theme switching works
# Detail panels open/close
```

### 5. CI lint
```bash
node scripts/lint-actions.js
```
Ensures GitHub Actions don't regress to floating @vN tags.

### 6. Commit & PR
If all tests pass:
```bash
git add -A
git commit -m "data: refresh $(date +%Y-%m-%d) — <summary>"
git push -u origin <branch-name>
gh pr create --draft --title "Data refresh $(date +%Y-%m-%d)" --body "..."
```

Optional: Merge PR after confirmation (requires manual approval or `--auto-merge` flag).

## Output

- ✓ All validation passed
- ✓ N new news items, M new policies (or "Skipped — network unavailable")
- ✓ Documentation consistent
- ✓ Tests passed
- ✓ Commit: `<hash>`
- ✓ PR: <link>
- [Awaiting merge confirmation...] (unless `--auto-merge`)

## Exit codes

- **0** — Success; PR created (or merged if `--auto-merge`)
- **1** — Validation failed; no commit
- **2** — Tests failed; no commit
- **3** — Documentation drift detected; flagged but didn't fail
- **4** — Network unavailable; skipped scrapers but continued validation
- **130** — User cancelled (Ctrl+C)

## Related

- `scripts/validate.js` — Data schema validation
- `scripts/scraper-news.js` — News scraper (RSS aggregator)
- `scripts/scraper-policy.js` — Policy scraper (Federal Register)
- `scripts/lint-actions.js` — CI lint for GitHub Actions
- `README.md` — Project documentation
- `uat.md` — UAT baseline
- `.github/workflows/pages.yml` — Deployment pipeline

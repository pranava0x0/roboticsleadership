# data-refresh — Robotics Tracker Data & Docs Sync

Automates the full data refresh, documentation sync, testing, and PR merge workflow for the Robotics Tracker.

## What it does

1. **Data validation** — Runs `scripts/validate.js` to verify all 9 data files (companies, policies, news, themes, sources, agencies, state_policy, supply_chain, us_china)
2. **Source-coverage audit** — Runs `scripts/check-sources.js`: every claim node in supply_chain.json and us_china.json must carry a source URL (100% coverage is the bar)
3. **Data scraping** (optional) — Runs news & policy scrapers if network is available; gracefully skips if blocked
4. **Manual-data staleness sweep** — Flags records that scrapers don't cover (see "What scrapers don't refresh" below)
5. **Documentation sync** — Checks for drift between README/UAT and actual codebase structure; flags inconsistencies
6. **Testing** — `npm test` (scraper tests + supply-chain integrity + us-china integrity + source audit), page loads, navigation
7. **CI lint** — Runs `scripts/lint-actions.js` to ensure GitHub Actions are SHA-pinned
8. **Commit & PR** — Creates a commit with standard message, opens a draft PR, merges to main on confirmation

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
Checks JSON schema, required fields, enum validity, cross-references. Covers the structured documents too: `supply_chain.json` (categories, companies/sites/financing, stakeholders, shipments, chain stages — all source-checked) and `us_china.json` (sections/metrics with edge ∈ {us, china, even}, unitree_case rows).

Companies schema notes:
- `map_category` is required, from the canonical set `{humanoid, brains, industrial, defense, field, service, enablers}` (mirrored as `SEGMENTS` display labels in `docs/companies.html`; the frontend iterates ids from the data, so a new id needs only a label there).
- `latest_valuation_usd`: for public companies this is **market cap with an as-of date** noted in `financials.details`; for privates it's latest post-money or credibly-reported. Null is valid when nothing is disclosed — never guess.

### 2. Source-coverage audit
```bash
node scripts/check-sources.js          # coverage report; exit 1 on gaps
node scripts/check-sources.js --list   # every unique URL with citation counts
node scripts/check-sources.js --live   # HEAD-check URLs (2s timeout, polite per-host spacing; informational)
```
Every claim-bearing node — BLUF, KPIs, chain stages, category summaries, chokepoints, companies, stakeholders, programs, facts, shipments, comparison metrics — must cite ≥1 URL. Max 2 sources per claim is the collection standard.

### 3. Scraping (if --no-scrape is not set)
```bash
node scripts/scraper-news.js   # Federal Register, IEEE Spectrum, TechCrunch, Reddit, HN
node scripts/scraper-policy.js # Federal Register robotics rules
```
Appends new items to `docs/data/news.json` and `docs/data/policies.json`. Gracefully skips if network blocks.

### 4. What scrapers DON'T refresh — manual research sweep
These live in curated files and rot silently; check staleness each refresh:
- **Valuations** (`companies.json`) — flag records with `last_updated` > 30 days or null `latest_valuation_usd` where a round/market cap likely exists. Public-company market caps drift constantly; stamp the as-of month.
- **Supply-chain capacity & financing** (`supply_chain.json`) — magnet t/yr figures, factory ramps (BotQ rate, RoboFab, Hyundai GA), DoD/OSC awards, China export-control status (Oct 2025 controls suspended only until **Nov 2026**; DFARS non-China magnet deadline **Jan 2027** — both are live tripwires).
- **US-vs-China metrics** (`us_china.json`) — IFR World Robotics lands ~September each year (refresh installs/density rows); TrendForce/Counterpoint humanoid figures update quarterly; SemiAnalysis Unitree numbers (price, margins, shipments) move fast.
- **Shipments by robot class** (`supply_chain.json → shipments`) — IFR industrial + service robot units, humanoid forecasts.
- **New company discovery** (`companies.json` — new entries) — Monitor X.com bookmarks/follows plus TechCrunch, Y Combinator, AngelList/Wellfound, Crunchbase, and Reddit to catch emerging founders, funding announcements, and company pivots before news aggregators pick them up. Method (refined 2026-06-30, third iteration of this sweep):
  1. **X.com**: requires Claude in Chrome connected and signed in (no API — see backlog.md). Logged-in DOM harvest of the user's bookmarks (`x.com/i/bookmarks`) and following list (`x.com/<handle>/following`), scroll + dedupe by permalink/handle. X's virtualized timeline stalls on plain `scrollTo` after ~7-18 items — alternate a large scroll-up "jiggle" (`scrollTo(0, scrollHeight - 12000)`) with forward `scrollBy` steps, each followed by a dispatched `scroll` event, to keep triggering its pagination fetch.
  2. **TechCrunch / YC / AngelList+Crunchbase / Reddit**: one research agent per source, each given the full current company-name list (to avoid re-researching tracked companies) and a hard cap on candidates returned (ranked, most important first — see AGENTS.md §11). Expect real overlap across sources (the same funding story breaks on TechCrunch, gets indexed by Crunchbase, then discussed on Reddit) — this is not a partitioning failure, just dedupe the results at synthesis time by normalized company name. If a source is structurally inaccessible in an agent's sandbox (e.g. Reddit can be WebFetch-blocked), have it report that and fail fast rather than silently substituting generic web search and burning its budget compensating.
  3. Cross-check every candidate against the current `companies.json` id list, then multi-source verify (max 2 sources/claim, prefer primary) before writing a record.
  4. Results written to `data/research/companies-discovered-YYYY-MM-DD.md` (audit trail — note the `data/research/` prefix, not bare `data/`) before merging into `companies.json`.

When researching these, follow AGENTS.md §11–17 (research-agent economy): seed-then-spawn, partition entities across agents, validator bar + early-bail in prompts, results written to `data/research/*.json` (not returned into conversation), max 2 sources per claim.

### 5. Documentation sync check
- Verify README.md lists all pages in `docs/` — currently 7: index, companies, policies, supply-chain, china, states, themes
- Verify UAT.md covers all pages + critical flows
- Flag any pages that exist but aren't in docs
- Flag any missing required fields in documentation

### 6. Testing
```bash
npm test   # scraper-news.test + supply-chain.test + us-china.test + check-sources
```
Then page loads:
```bash
for page in index companies policies supply-chain china states themes; do
  curl -s http://localhost:8765/${page}.html | grep -q '<main' || fail
done
curl -s http://localhost:8765/data/{companies,news,policies,themes,supply_chain,us_china}.json
```

**UI verification for data-driven pages (browser, not just curl):**
- DOM-count smoke check FIRST — one `preview_eval` counting rendered sections catches a blank/half-rendered page for ~100 tokens (this caught a TDZ bug the test suite missed). Expected non-zero counts:
  - companies.html: `details.mm-panel` = 7 (accordion market map), `#companies-tbody tr` > 0
  - supply-chain.html: `.chain-stage-card` = 6, `.ship-row` ≥ 3, `#us-sites-table tbody tr` > 0, `.cat-block` = 12, `.entity` ≥ 15
  - china.html: `.vs-table` ≥ 5, scoreboard populated
- Screenshots only at scroll position 0 (the preview tool renders blank at any other scroll — see issues.md 2026-06-12); one desktop + one mobile (375px) shot.
- Interactions: market-map bubble click → dossier opens; "filter table" pill → segment filter applies; nav highlights the active page.

### 7. CI lint
```bash
node scripts/lint-actions.js
```
Ensures GitHub Actions don't regress to floating @vN tags.

### 8. Commit & PR
If all tests pass:
```bash
git config user.name "pranava0x0"
git config user.email "2497510+pranava0x0@users.noreply.github.com"
git add -A
git commit -m "data: refresh $(date +%Y-%m-%d) — <summary>"
git push -u origin <branch-name>
gh pr create --draft --title "Data refresh $(date +%Y-%m-%d)" --body "..."
```
The `git config` lines are local (repo-scoped), not `--global` — a cloud-run session has no pre-existing identity and would otherwise commit as its own default bot account.

Optional: Merge PR after confirmation (requires manual approval or `--auto-merge` flag).

Pretty-printer rule: `companies.json` and all `docs/data/*.json` are written with **2-space indent + trailing newline** (`JSON.stringify(data, null, 2) + '\n'`). A 1-space write once produced an 8,588-line phantom diff — always skim `git diff --stat` on data files before committing.

## Output

- ✓ All validation passed (9 files)
- ✓ Source coverage: N/N claims
- ✓ N new news items, M new policies (or "Skipped — network unavailable")
- ✓ Staleness sweep: N records flagged for manual research
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

- `scripts/validate.js` — Data schema validation (incl. supply_chain + us_china documents)
- `scripts/check-sources.js` — Source-URL coverage audit (--list, --live)
- `scripts/scraper-news.js` — News scraper (RSS aggregator)
- `scripts/scraper-policy.js` — Policy scraper (Federal Register)
- `scripts/supply-chain.test.js`, `scripts/us-china.test.js` — Page/data integrity tests
- `scripts/lint-actions.js` — CI lint for GitHub Actions
- `data/research/` — Scratch JSON from research agents (not served; not part of docs/)
- `AGENTS.md §11–17` — Research-agent economy rules
- `README.md` — Project documentation
- `uat.md` — UAT baseline
- `.github/workflows/pages.yml` — Deployment pipeline

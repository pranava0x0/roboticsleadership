# Robotics Industry & Policy Tracker

A live-updating dashboard consolidating robotics startups, government policy, industry data, and market signals. Built for investors, policymakers, founders, and congressional staffers tracking the robotics acceleration.

**Stack:** vanilla HTML / CSS / JS + JSON files. No build step, no npm install, no backend. Serve `docs/` from any static host (GitHub Pages, Vercel, Netlify, Cloudflare Pages, or a local `python -m http.server`).

---

## What's in here

```
docs/                  static site, publish root
  index.html           dashboard
  companies.html       directory + detail panel
  policies.html        federal bills, agencies, state incentives (collapsible sections)
  states.html          state-policy overview (key themes + what's on the books)
  themes.html          deep-dives
  china.html           US vs. China robotics metrics & comparisons
  supply-chain.html    supply-chain ecosystem, manufacturing, capacity
  energy.html          energy systems & robotics data
  assets/
    styles.css         design system tokens + components (incl. BLUF callout)
    app.js             shared utilities (fetch, format, theme toggle)
  data/
    companies.json     ~60 companies, funding rounds, deployments
    policies.json      federal bills, state incentive programs
    state_policy.json  curated state-policy themes (delivery robots, AV, incentives, clusters, AI preemption)
    news.json          news + research items
    themes.json        cross-cutting narratives
    sources.json       scraper config
    supply_chain.json  supply-chain stages, companies, financing, chokepoints
    us_china.json      US vs. China robotics metrics & comparisons
    energy.json        energy systems & robotics tracking

scripts/               Node.js scrapers (Node 18+, no deps)
  scraper-news.js      RSS aggregator (Federal Register, IEEE Spectrum, TechCrunch)
  scraper-policy.js    Federal Register search
  validate.js          schema check across all data files (now incl. state_policy)
```

---

## Running locally

Any static server works. Three options:

```bash
# Option 1: Python
python3 -m http.server -d docs 8000

# Option 2: Node (no deps)
npx --yes serve docs

# Option 3: just open docs/index.html in a browser
# (Note: fetch() of local files needs a server. Option 1 or 2.)
```

Then visit <http://localhost:8000>.

---

## Updating data

### Manual edit

Edit `docs/data/*.json` directly. Every record needs:
- a stable `id` (kebab-case slug)
- at least one `source_url` (entries without sources are rejected by reviewers)
- today's date in `last_updated`

Validate after editing:

```bash
node scripts/validate.js
```

### Scraping

```bash
# News: Federal Register, IEEE Spectrum, TechCrunch
node scripts/scraper-news.js

# Policy: Federal Register robotics-related rules
node scripts/scraper-policy.js
```

Scrapers append to the JSON files in-place. Diff before committing.

GitHub Actions wiring is planned (see `backlog.md`); for now, the cadence is manual:
- News: daily-ish
- Policy: weekly (Monday)
- Companies: weekly + ad-hoc as funding rounds break

---

## Conventions

- **Read-before-edit.** See `AGENTS.md`.
- **Cite primary sources.** Every numeric claim has a `sources[]` entry. No source → record doesn't ship.
- **No paraphrasing.** News summaries quote verbatim or are curator-written; never LLM-paraphrased.
- **Curator-only classifications.** `impact_tier`, `sentiment`, `data_confidence` are human calls, not LLM-generated.
- **Append-only news.** New articles append; deduplicate by `source_url`.
- **Source attribution.** Every record carries its origin (`source_url` or `sources[]`).

---

## Project hygiene

- **`backlog.md`** — what's next
- **`issues.md`** — what's broken
- **`security.md`** — supply-chain advisory sweep log
- **`CLAUDE.md`**, **`AGENTS.md`**, **`DESIGN.md`** — folder-level principles + this project's overrides

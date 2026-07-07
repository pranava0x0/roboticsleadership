# Robotics Tracker — Data Refresh Skill

> Project refresh playbook, read by the generic `data-refresh` skill (~/.claude/skills/data-refresh). Keep current: every refresh run appends learned patterns; structural pipeline changes get edited into the body.

## What this skill does

The site is a **zero-dependency static dashboard**: all content is JSON in `docs/data/`, rendered
client-side. A refresh means running the scrapers, gating on the validator, pruning ambiguous
auto-scraped records, and reporting — then teaching itself anything new it learned (see the last
section).

Each run:

1. Loads current state (data files + sources config + issues/backlog).
2. Runs the enabled scrapers (news daily-style, policy weekly-style).
3. **Validates** — `validate.js` is the gate; a failed validate means the refresh is NOT done.
4. Fixes any validation failure at the source (the scraper), then backfills the written record.
5. Curates: flags borderline auto-scraped records for the human curator (never silently ships noise).
6. Reports what changed.
7. **Self-improves** — appends any new pathway/pattern to the Learned-patterns log in this file.

---

## Key facts (stable reference)

```
Project root:   /Users/pranava/Projects/Robotics Leadership/
                (work happens in the active git worktree under .claude/worktrees/<name>/)
Repo:           roboticsleadership   |   Stack: vanilla JS, no build, no runtime deps
Data dir:       docs/data/
  news.json       — array of news records (newest first)
  policies.json   — array of policy records
  companies.json  — array of company records
  themes.json     — curator-authored themes
  agencies.json   — R&D agencies (powers policies.html R&D table)
  sources.json    — scraper source config + _meta.last_updated
Scrapers:       scripts/scraper-news.js     (RSS → news.json + sources.json)
                scripts/scraper-policy.js   (Federal Register API → policies.json)
                scripts/archive-sources.js  (Wayback snapshots; MONTHLY maintenance — run only if asked)
Validator:      scripts/validate.js   ← the eval loop; run after EVERY scrape
Render layer:   docs/assets/app.js (RT.* helpers) + per-page inline scripts in docs/*.html
Today's date:   use currentDate from context (do NOT hardcode)
```

### Commands

```bash
cd <active-worktree>           # the .claude/worktrees/<name> dir, NOT the bare project root
node scripts/scraper-news.js   # fetches enabled RSS sources, dedupes by source_url, writes
node scripts/scraper-policy.js # fetches Federal Register, dedupes by html_url, writes
node scripts/validate.js       # MUST pass clean before declaring done
# Optional monthly: node scripts/archive-sources.js   (and --save-missing)
```

### Schema required fields (what validate.js enforces)

```
news:      id, title, date, source, source_url, summary, category, sentiment, confidence
policies:  id, title, type, level, introduced_date, status, summary, robotics_scope,
           sources, last_updated, themes
companies: id, name, founded, hq, website, funding_rounds, tags, data_confidence,
           sources, last_updated, themes
agencies:  id, name, full_name, parent, url, show_in_rd_table, notes
```

### Source config facts (`docs/data/sources.json`)

- News scraper processes only `type === 'rss' && enabled` entries. Current enabled RSS:
  `ieee-spectrum-robotics`, `techcrunch-robotics-tag`, `the-robot-report`.
- `reddit-robotics` (type `reddit-json`) is **disabled** — the news scraper ignores non-RSS types.
- `federal-register-robotics` lives under `sources.news` but is type `federal-register-search`;
  the **news** scraper skips it. Federal Register is handled by the **policy** scraper, whose
  enabled source id is `federal-register-policy`.

---

## Step 0 — Load current state (never skip)

```
Read: docs/data/sources.json      (which sources are enabled; current _meta.last_updated)
Read: issues.md                   (open issues, recent scraper lessons)
Read: backlog.md                  (curation/guard ideas)
```
Note the current news/policy `date` range and counts so you can report the delta:
`node -e "const n=require('./docs/data/news.json'); console.log(n.length, n.map(x=>x.date).sort().slice(-1)[0])"`

## Step 1 — Run the scrapers

Run `scraper-news.js` then `scraper-policy.js`. Capture per-source counts. The scrapers write
directly to the JSON files and bump `sources.json` `_meta.last_updated` to today. (In CI these run
behind a PR; locally the edits land in the working tree for curator review — that is intentional.)

## Step 2 — Validate (the gate)

Run `node scripts/validate.js`. If it fails:
- **Fix at the source.** A missing/!malformed field means the scraper template is wrong — patch the
  scraper (e.g. `scripts/scraper-policy.js`), THEN backfill the already-written record(s) so the
  current file validates. Do not hand-edit only the data and leave the scraper broken.
- Re-run validate until **"All files valid."** with 0 broken cross-refs.

## Step 3 — Curate ambiguous auto-scraped records

The Federal Register `robotics` term still surfaces weak matches (committee renewals, generic
CS/AI notices). Per the project's hard-won lesson (issues.md, 2026-05-17), **ambiguous ingestion
must be pruned by a human, never silently shipped.** For each new policy/news record that is not
clearly robotics-relevant, surface it explicitly in the report and ask the curator whether to drop
it. Do not delete curator-relevant records on your own.

## Step 4 — Report

Report: per-source counts, new date range, any scraper bug found+fixed, validate result, and a
bulleted list of borderline records needing a curate/prune decision. State clearly whether
`archive-sources.js` was run (default: not run — it is monthly maintenance).

## Step 5 — Self-improvement (run this EVERY time)

Reflect on the run. **If — and only if — you hit a NEW pathway or pattern** not already captured
below, edit THIS file (`~/.claude/skills/robotics-data-refresh.md`) and:

- Append a dated bullet under **## Learned patterns**. One or two sentences. Concrete and
  actionable ("Source X needs header Y", "field Z newly required", "term W over-matches on …").
- If the new fact is *stable* (a path, command, schema field, enabled-source change), also update
  the **Key facts** section so future runs start correct.
- Dedupe: if the pattern is already logged, do nothing. Never rewrite history or delete the
  curator-prune discipline. Keep the log tight — promote recurring lessons into Key facts and
  trim the one-off note.

If nothing new was learned, skip the edit and say so. This is what keeps the skill compounding.

---

## Learned patterns
<!-- Auto-maintained by Step 5. Newest first. Keep each entry to 1-2 sentences. -->

- **2026-06-01** — `scraper-policy.js` built records without the schema-required `themes` field;
  `validate.js` rejected the new record. Fix: template now includes `themes: []`. Lesson: any new
  scraper record template must carry every required field for its dataset (see Key facts schema list).
- **2026-06-01** — Federal Register `term=robotics` pulls borderline non-robotics matches (e.g.
  *"Proposal Review Panel for Computer and Network Systems; Committee Renewal"*, an NSF committee
  renewal). These are valid+traceable but noise — always flag them for the curator in Step 3.
- **2026-06-01** — `the-robot-report` RSS 403s on unknown User-Agents; the scraper already sends a
  browser-like UA. If a source starts returning 403/empty, check the UA header first.
- **2026-06-01** — The news scraper silently skips non-`rss` source types, so
  `federal-register-robotics` under `sources.news` is a no-op there — Federal Register data comes
  only from the policy scraper. Don't expect news counts to include Federal Register items.

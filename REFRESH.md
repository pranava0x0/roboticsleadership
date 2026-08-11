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
Scrapers:       scripts/scraper-news.js     (RSS + Hacker News + Federal Register → news.json + sources.json)
                scripts/scraper-policy.js   (Federal Register API → policies.json)
                scripts/archive-sources.js  (Wayback snapshots; MONTHLY maintenance — run only if asked)
Curated source: owner's X **PhysicalAI** list (public, 103 members) + bookmarks (@pranava0) — check every refresh (see Step 3b)
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

- News scraper processes `type === 'rss' && enabled` entries **plus a built-in Hacker News
  (Algolia) pass and a Federal Register news pass** — these are wired into `scraper-news.js`
  directly, not gated by `sources.json`. Current enabled RSS: `ieee-spectrum-robotics`,
  `techcrunch-robotics-tag`, `the-robot-report`.
- **The Hacker News pass (`hacker-news-robotics`, queries `robot`/`robotics`/`humanoid`) is
  low-precision and summary-less** — expect ~20+ noise records per run and prune the whole
  batch during curation (see issues.md 2026-07-20). It is the single biggest source of
  curator work; the trade RSS is the quality tier.
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

**Hacker News is the biggest prune target.** The HN pass (`hacker-news-robotics`) over-matches on
`human*` and incidental `robot` mentions; expect ~20+ noise records per run with no summary. Read
the titles, keep only clearly on-thesis items with a credible source, drop the rest. The trade RSS
(Robot Report etc.) is the quality tier.

## Step 3b — Harvest the owner's curated X source (every refresh)

The best signal is human-curated, not scraped. Pull the owner's **X `PhysicalAI` list** and
**bookmarks** for physical-AI news and ideas:

- List: `x.com/i/lists/2061938532722311396` (owner @pranava0, 103 members, **public as of 2026-07-27** —
  no login required to view, though harvesting still goes through the owner's logged-in
  claude-in-chrome browser since bookmarks stay private). Bookmarks: `x.com/i/bookmarks`.
- Use the **claude-in-chrome** browser. Harvest with `javascript_tool`:
  `document.querySelectorAll('article')` → `{url, datetime, innerText}` into a `window.__collected`
  `Map` keyed by status URL, re-run after each scroll to accumulate.
  **Programmatic scroll does not reliably load more posts and can freeze the tab.** `window.scrollTo`/
  `scrollBy` do move `window.scrollY` (confirmed via direct check), but the feed's infinite-scroll
  fetch did not fire even at true bottom-of-page across repeated checks — and a tight loop of
  `scrollTo`/dispatched `WheelEvent`s once caused a 45s `Runtime.evaluate` timeout with the tab left
  blank (had to reload). **Use the `computer` tool's real `scroll` action instead**
  (`{action:"scroll", coordinate:[~700,400], scroll_direction:"down", scroll_amount:15}` via
  `browser_batch`, ~1.2s wait between steps) — this reliably loads new posts. Harvest with
  `javascript_tool` between scroll batches. Bookmarks are ordered by *save time*, not tweet date, so
  expect occasional old outliers (e.g. a 2025 tweet) mixed into a recent run — that's normal, not a
  sign to stop early.
- Once collected, filter the map in-page with a robotics/physical-AI keyword regex before pulling
  results out to the agent — the raw collected set is dominated by adjacent AI/energy/finance content
  the owner also bookmarks, and pulling untriaged text wastes context. Pull matches in small batches
  (~3 items, text truncated to ~250 chars) — the tool result silently truncates long JSON strings,
  so ask for less per call rather than debugging a truncated payload.
- For each item worth adding: **verify with a web search to get the PRIMARY source**, then hand-author a
  news record with real fields (don't ship a bare tweet as the record). **Cross-check against
  news.json by keyword first** — the automated scrapers (RSS/HN/Federal Register) often already
  caught the same story the owner bookmarked (2026-07-27: of ~8 strong candidates from a combined
  108-bookmark + 56-list-post sweep, all but 2 — a United Airlines humanoid-robot cabin ban and
  Unitree's TIME cover — were already in news.json under different ids). Log unverifiable anecdotal
  claims (e.g. a specific "China funded 150 robotics startups vs. US funded 15" figure with no cited
  source) to backlog as a research idea instead of shipping them as fact.
- Precedent (2026-07-20): Sunday Robotics ACT-2 → sunday.ai; microagi $55M seed → Sifted.
  (2026-07-27): United Airlines humanoid/animal-robot cabin ban → Aviation A2Z; Unitree founder TIME
  cover → time.com.

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

- **2026-08-10 (refresh run, web-search-only, no browser)** — All 3 Federal Register policy hits this
  run were false positives of a **new noise class**: a Foreign-Trade Zone production-activity notice
  (Abbott diagnostics, `robot` never appears — matched on something else in the doc), a hazmat/battery
  Materials-of-Trade rule for landscaping/construction crews, and a DHS H-1B/L-1 biometric visa fee
  rule. None mention robotics; same "traceable but irrelevant" class as the fee-schedule/committee-
  renewal noise already logged, just different subject areas — Federal Register's `term=robotics`
  match is broad enough that almost any policy area can surface once. Of 27 HN-flagged news records,
  13 were on-thesis (6 trade-RSS-adjacent HN posts incl. a Knightscope/security-robot deep dive that
  read as noise from the title alone — "Roboguard" — until checked; Waymo robotaxi is an established
  on-site category, not a borderline call) and 14 were noise (Excel/genetics, a 1970s Lem sci-fi essay,
  WSJ Taiwan geopolitics with no robotics angle, DynamoDB, Zuckerberg/Meta, an edge-LLM Show HN that
  only tangentially lists "robots" among five target platforms). **Lesson: don't drop an HN title just
  because it reads generic — check the source URL/summary before pruning; "Roboguard" would have been
  wrongly cut on title vibes alone.**
- **2026-07-29 (refresh run 10:51am)** — **Hacker News false-positive culling: the 30 HN records ingested this run included 11 pure noise** (robots.txt HTTP protocol, robocall spam, math proofs, generic AI/politics) that matched "robot/robotics" but had zero relevance; all were curated out. The quality RSS feeds (IEEE, TechCrunch, Robot Report) contributed 11 on-topic records with no curation needed. **Lesson: HN low-precision requires curator review every run — don't try to automate the gate.** Also: Reddit returned 403 (expected), Federal Register API returned 503 (transient).
- **2026-07-29** — **The list is public to read but X still gates list *timelines* behind login for logged-out visitors**, so the in-app browser hits the sign-in wall on `x.com/i/lists/<id>` and only claude-in-chrome (the owner's session) can harvest it. Corollary learned the hard way: **claude-in-chrome returning "not connected" is usually transient — retry before reporting the harvest blocked.** It failed twice, was written up as unavailable, and then connected on the first retry.
- **2026-07-29** — The `computer`-tool scroll pattern from 2026-07-27 works exactly as documented: 6 scroll+wait batches (10 ticks, 1.5s) took the list from 5 to 33 posts with no stalls. Harvest between batches, then filter in-page with the robotics regex and pull matches in slices of ~4 with text truncated to ~320 chars — the tool result silently truncates long JSON. **Expect the list to be dominated by one story on a big news day** (this run: ~15 of 23 matches were the FCC Covered List action), which is itself signal: it independently confirmed the record already authored from primary sources, and only one genuinely new item (Tau Robotics' SF cleaning launch) came out of 33 posts. Budget the sweep accordingly — it is a confirmation and long-tail tool, not a primary discovery channel.
- **2026-07-29** — When adding a **news source**, `sources.json` entries now need a `publication` field (the masthead). The record constructors read `source.publication || source.id`; omitting it silently puts the scraper slug in the byline, which is how 729 records ended up reading `hacker-news-robotics`. The scraper warns once per source, but nothing fails — check the warning line in the run output.
- **2026-07-27** — The owner's PhysicalAI list is now **public** (no login to view; still harvested via
  the owner's logged-in browser for bookmarks). Programmatic `scrollTo`/`scrollBy` moves `window.scrollY`
  but does not reliably trigger the feed's infinite-scroll fetch, and a tight JS scroll+dispatch loop
  once froze the tab for 45s — use the `computer` tool's real `scroll` action instead (see Step 3b for
  the full pattern). Also: most X-sourced candidates turn out to already be in news.json via the
  automated scrapers — cross-check by keyword before authoring a record, don't assume the X find is new.
- **2026-07-20** — The scrapers now also run a **Hacker News (Algolia)** pass, not documented
  before this run. It over-matches badly: `humanoid` typo-tolerance catches any `human*` word,
  so one run pulled 28 records (~21 pure noise: Panama Papers, Big Oil, ICE, Swedbank) all with
  no summary. Curate = drop the whole HN batch unless an item is clearly on-thesis with a real
  source; keep the trade RSS. Tracked in issues.md; fix options in backlog.
- **2026-07-20** — Federal Register `term=robotics` false positive of the run: a **Medicare CY2027
  Physician Fee Schedule** rule (surgical-robotics mention buried in a payment reg). Same class as
  the NSF committee-renewal noise — flag/drop Fed-Register records whose subject is a fee schedule
  or committee action rather than robotics policy.
- **2026-07-20** — Curated additions can come from the owner's **X `PhysicalAI` list + bookmarks**
  (`x.com/pranava0`, list id `2061938532722311396`). Harvest via the claude-in-chrome browser;
  Twitter virtualizes the feed so programmatic scroll only yields the first ~8 posts — take the top
  signal, verify each item with a web search for its **primary** source, then hand-author the news
  record (this run: Sunday Robotics ACT-2 → sunday.ai; microagi $55M seed → Sifted).

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

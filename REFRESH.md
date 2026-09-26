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
Curated source: owner's X **PhysicalAI** list (public, 129 members as of 2026-08-14, was 103 — membership drifts, re-verify via x.com/pranava0/lists) + bookmarks (@pranava0) — check every refresh (see Step 3b)
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

- **2026-09-26 (scheduled full-site refresh)** — **`curl -sL --compressed -A "Mozilla/5.0"` reads pages that WebFetch 403s.** Ars Technica, SCMP, KrASIA, Al Jazeera, mujin.co.jp and asirobots.com all came back 200 with the article body; strip `<script>/<style>` and tags with a few lines of Python and read the first 2-4 KB. Without `--compressed` the ASI release came back as gzip garbage. Bloomberg still serves a bot wall. This closed the "Ars returned 403" gap the wide-search agent reported the same run.
- **2026-09-26** — **The X list's chronological view is dominated by one prolific replier for hours at a time** (Steven Cheng: ~15 of the last 20 timeline rows). `x.com/search?q=list:<id> -filter:replies since:YYYY-MM-DD&f=live` drops replies and returns ~20 original posts per pass; add a keyword-OR pass only for funding/deployment words. Each `computer` scroll returns a screenshot whether wanted or not, so budget ~4 scrolls per pass and stop when the count stops moving. Strip non-ASCII (`replace(/[^\x20-\x7E]/g,'')`) before pulling text out: the tool truncates on the first non-ASCII character. Three genuinely new leads from ~45 posts (Mujin's award, IROS preview, an actuator supplier-map thread); most of the rest was already ingested the day before.
- **2026-09-26** — **When an `auto/*` PR is open, use its branch as candidate input rather than a to-do item.** `git show origin/auto/news-<date>:docs/data/news.json` gives that day's flagged records; diff them against your curated `news.json` by `source_url` to write `data/research/refresh-<date>-dropped.json` (the future blocklist input from `ingestion-plan.md`), then merge the branch with the curated file kept. Two of 50 candidates were keepers (both Ars pieces); 48 were HN keyword noise, TechCrunch Disrupt ticket promos (six per run), product PR, and events.
- **2026-09-26** — **`RT.loadNewsRecent()` + a gitignored `docs/data/news-recent.json` (written by `render-static.js` in both modes) keep the front page off the 1,000-record archive.** The loader falls back to `news.json` when the file is missing, so a local `python -m http.server` still works, but the page then weighs what it did before; run `node scripts/render-static.js` once to generate it. A browser pane that cached the old `app.js` reported `RT.loadNewsRecent is not a function` after the edit — hard-reload (`fetch(url,{cache:'reload'})` then `location.reload()`) before debugging.
- **2026-09-26** — **Pane measurements lie until the tab has painted, and emulated widths only apply after a screenshot.** With the pane hidden, the iframe probe reported horizontal overflow on every page at 375px (the priority+ nav had not collapsed because `requestAnimationFrame` never fired) and `innerWidth` stayed 811 after `resize_window`. Take a `computer` screenshot first, then run the probe.
- **2026-09-26** — Rare-earth control status moved: the US-China truce was extended on 2026-09-24 and Al Jazeera reports the suspended Chinese ban delayed to 2027-01-10 (one outlet says a year). The suspension date lives in one `supply_chain.json` fact now, not inside the DFARS fact; keep it there so the next extension is a one-line edit.

- **2026-09-25 (scheduled full-site refresh, scheduler run with no human present)** — **Some scheduler environments have no `node`, and the `git`/`python3` shims exit 69 on an unaccepted Xcode license.** Workarounds that worked without touching system settings: `git` at `/Library/Developer/CommandLineTools/usr/bin/git`, Python 3.9 at `/Library/Developer/CommandLineTools/usr/bin/python3` (runs `slopcheck.py`/`designcheck.py` fine), and a Node 24 binary bundled at `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node` symlinked into a scratch `bin/` on PATH. Probe with `node -v` first; if none exists, say the gates could not run rather than skipping them silently.
- **2026-09-25** — **IFR World Robotics lands around 09-24 each year and touches five places, not one:** `us_china.json` (industrial-installs row, domestic-supplier share in `cobot-selfsufficiency`, bluf headline percentage), `supply_chain.json` (industrial shipments row, the "Industrial robots" KPI, and `production_trend`, where last year's *projected* row becomes actual and a new projected row is derived from IFR's regional growth rates), and a hardcoded "54% of world robot installations" string in `index.html`. `grep -rn "54%\|295" docs/` after the data edit caught the last one; a chart caption ("roughly flat for a decade") also needed a dated range instead. `scripts/layout-guards.test.js` now asserts the trend's latest actual row equals `shipments.industrial`.
- **2026-09-25** — **Two JSON formatting regimes coexist.** `companies.json`, `news.json`, `policies.json`, `sources.json` are canonical 2-space (assert `JSON.stringify(x, null, 2) + '\n' === raw` before a round-trip write); `supply_chain.json` and `us_china.json` keep one compact object per line, so a round-trip would rewrite every row. Edit those line-by-line (find the unique line, splice), and re-run `validate.js` after; `git diff --stat` should show tens of lines, not thousands.
- **2026-09-25** — Fetch agents (WebFetch) get 403 on BusinessWire, Cognex, TechCrunch (some), RobotToday and Counterpoint bodies, and a TLS error on china.org.cn. Corroborate through several search results from different outlets, cite the primary URL anyway (it resolves for readers), and state in the record when the body was not readable (Counterpoint H1 record does). Numbers that differ between secondaries (AgiBot H1 units 8,400 vs 9,700) get shares only, not units.
- **2026-09-25** — Front-page lead is simply the newest `date`, ties broken by array position, so a record dated the day of the run leads. Author records with their honest publication date and place the ones you want on top first in the array; do not back-date or forward-date to steer it.
- **2026-09-25** — The wide-search sonnet agent returned 24 items in ~7 minutes, of which about 15 survived verification; it correctly self-flagged low-confidence items (Toyota via secondary, O-ID TLS failure, Tesla app-leak). Treat its `confidence` field as load-bearing, drop `low` unless a second source appears, and re-verify anything with a headline number.

- **2026-09-17 (30-day X sweep — `list:` search operator beats linear scroll for targeted signal)** — Asked to sweep the PhysicalAI list over 30 days rather than "since last check," a pure chronological scroll proved impractical: ~10 scroll batches only covered ~24 hours of feed at this list's current density, so 30 days would need hundreds of batches. Switching to X's `list:<id> (keyword OR keyword...) since:YYYY-MM-DD until:YYYY-MM-DD` search operator (e.g. `list:2061938532722311396 (policy OR bill OR tariff OR regulation) since:2026-08-18 until:2026-09-17`) let a single search-and-scroll pass surface every matching post across the full window directly — used one pass for policy/bill keywords and one for funding keywords (raised/Series/acquisition/IPO), each exhausted in ~5-8 scroll batches instead of hundreds. The policy-keyword pass also surfaced `@robotforamerica`, a dedicated robotics-policy trade-association account (joined Jan 2026) whose own timeline, scrolled directly, was far denser in real bill/tariff/regulation signal than generic keyword matches (which skew toward RL "policy network" and "bill of materials" false positives). For a policy/bill-focused sweep, prefer `list:` search + high-signal-account timelines over a blind chronological scroll.
- **2026-09-16 (local `main` ref was stale — corrupted the very first dedup pass)** — In a fresh session on this checkout, local `git branch main` still pointed at `09de87a` (three merges behind `origin/main` @ `df1115f`) even though the working branch itself was correctly up to date — nothing had ever run `git fetch origin main` to move the local ref. The first `auto/*` vs `main` dedup pass used that stale local ref as the baseline and got 70 "new" news candidates, 18 of which (Skild AI's $100M ARR, China's CSRC/Unitree IPO story, Samsung SDS/Walden, Maven Robotics, Boston Dynamics/Dynamic Creatures, Facet-0, and others) were already merged into the real `main` on 2026-09-11 — the resulting `git diff --stat` showed a 1,700+ line news.json rewrite that was actually a revert-and-reapply of already-shipped content, not new data. Caught by CLAUDE.md's own git-discipline rule ("verify local vs. remote before syncing") applied one level down: always diff against `origin/<branch>` (or re-derive the baseline from `git show HEAD:...` on the branch you're actually building on), never a bare local branch name, when computing a "what's new" set. Re-ran the dedup against the correct baseline (952 existing news records, not 934) and got the accurate figure below.
- **2026-09-16 (scheduled refresh, 6 open `auto/*` PRs found unmerged since 09-11)** — Diffing the newest open `auto/news-2026-09-15` and `auto/policy-2026-09-14` branches against the *correct* `origin/main` baseline by id+`source_url` (not trusting either branch alone — per the 09-11 lesson below) surfaced 52 news candidates and 2 policy candidates; kept 19 news / 1 policy. Noise this run skewed heavily toward **generic AI-doom/AI-safety op-eds surfacing under the "robot"/"human" HN stem match** (10 of the ~33 dropped news items — NYT/BBC/Verge/Substack pieces on AI risk with zero robotics content) and **HN Show-HN hobbyist posts using "robot" as branding** (a mecha video game, a bootloader, a TTS tool, a git-history visualizer, a Bitcoin "RoboSats" coordinator) — same shape as the documented `human*`/`root` over-matches, worth adding "AI safety/doom essay" as its own named noise class alongside them. The D2D unlicensed-spectrum NPRM (first logged 2026-09-07) resurfaced yet again in both the policy and news Federal Register passes, confirming it needs a persistent drop-list rather than per-run pruning. One genuine borderline keeper: an FDA Class II classification of a "cooperative powered surgical assist device" for ENT surgery — read past the generic "Medical Devices;" title, it's actually a robotic-assisted surgical tool being brought into a real regulatory pathway, not the usual FR noise.
- **2026-09-16** — Company-record staleness (77 of 81 `companies.json` records >30 days stale) is too large a surface for a single scheduled run to fully re-verify; targeted the two corrections the week's own news cycle had already source-verified rather than a blind sweep: Unitree's post-IPO valuation (debuted at a ~$66B market cap on the STAR Market, down 53% by 2026-09-09 per The Robot Report — added as a new `funding_rounds` entry plus an updated `latest_valuation_usd` with the derivation noted in `financials.details`, per the "market cap needs an as-of date" schema rule) and Skild AI going from a `financials.details` string that still read "Pre-revenue" to a sourced $100M ARR run-rate with three named deployments (Bloomberg, 2026-09-10). Four more companies surfaced in news but not yet in `companies.json` (Walden Robotics, Monumental, Maven Robotics, Vention) were logged to backlog.md rather than added as under-researched stubs.
- **2026-09-11 (X list harvest)** — A single dominant story can saturate the ENTIRE visible feed for multiple days, not just "a big news day" as previously logged: Skild AI's $100M ARR announcement (Sep 10) produced so many reposts/quote-tweets/reaction posts that ~100 `computer`-tool scroll batches (the largest single-run scroll budget spent on this source so far) only pushed the timeline back to ~Sep 8-9 — three days of coverage, not the ~3-month target. Budget the sweep by scroll-batch count, not by target date range, when a mega-story is visibly dominating early in the scroll. Of ~145 unique posts collected and ~70 passing the robotics keyword filter, only 3 were genuinely new records after cross-checking news.json: Skild AI's $100M ARR milestone (Bloomberg), China's CSRC tightening humanoid IPO approvals after Unitree's post-debut plunge (China Money Network), and Samsung SDS's equity stake + robot-orchestration partnership with Walden Robotics (Seoul Economic Daily) — Maven Robotics' stealth launch and Boston Dynamics/Dynamic Creatures, both prominent in the list, were already caught by the automated scrapers same-day.
- **2026-09-11 (curator-only dataset sweep)** — `companies.json` records can go stale in ways a `last_updated` date alone won't reveal: `electric-sheep` (landscaping robots) was acquired by Oso Electric Equipment on 2025-10-22 and the record still read as an independent company nearly a year later with no acquisition noted — a material fact (not just a funding number) had drifted, not just gone unverified. Also, an aggregator name can mask a company merger/rename: a search for "General Reasoning" nearly got confused with the similarly-named but unrelated "General Intuition" (both AI/robotics-adjacent, raising in the same window) — always cross-check the exact domain/founder before trusting a search summary's company match. Separately, a YC/company-page snapshot can itself go stale fast for very young startups: `nori-robotics`'s on-file product name ("NORI L2", New York HQ) had already been superseded by the company's own current site ("NORI A3", San Francisco) by the time of the original entry — for sub-1-year-old startups, prefer the company's live site over whatever page was cited at record-creation time.
- **2026-09-11 (backlog-curation run, PRs #200/#201)** — **The "latest `auto/*` branch is a superset of the prior one" rule (2026-09-07 entry) does NOT always hold — verify it every time, don't assume it.** Diffing `auto/news-2026-09-10-144334` and `auto/news-2026-09-09-145841` against `origin/main` by record id found each branch had **12 new-vs-main records the other branch lacked** (35 new records each, only 23 in common) — not a superset either direction. Root cause: the HN pass uses a rolling lookback window, so a record that fell just inside the window on the 09-09 run (e.g. `hn-49583305`, 2026-09-06) had aged out by the 09-10 run, while the 09-10 run's own newer window caught records the 09-09 run couldn't see yet (e.g. `hn-49638976`, 2026-09-10). **Fix applied:** took the union of both branches' new-vs-main ids (47 unique) rather than trusting one branch alone — this is the correct general procedure whenever more than one un-merged auto branch exists and the gap between them is more than a few hours.
- **2026-09-11** — Same underlying blog post ("Robotics with Conan: consuming ROS as a regular package", blog.conan.io) surfaced as **two different HN item ids** a day apart (`hn-49608703` dated 09-08, `hn-49628460` dated 09-09) with an identical `source_url` — the news scraper's within-run dedupe-by-`source_url` doesn't catch this because the two ids came from *different scrape runs*, so accumulated-candidate merges (like this one) need a manual `source_url` dedupe pass, not just an `id` dedupe. Both were dropped anyway on content grounds (dev-tooling tutorial, not industry/policy/research substance) so it didn't matter here, but would have needed deduping had either been a keeper.
- **2026-09-11** — New HN noise classes this run: (1) **`root`-keyword over-matches** — Algolia's typo/stem tolerance on "robot" also pulls "root" hits with zero robotics content (device rooting — TV, e-reader, phone containers; math "roots"; a crypto "root cause analysis" postmortem; "The Root of the Root of All Evil" essay) — at least 8 records in one run, a previously-undocumented sibling of the known `human*` over-match. (2) **CG/game-dev "humanoid" tooling** — a Show HN "Zero-click 3D humanoid rigging" library is about character-animation rigging, not physical robots; reads on-topic from the title alone. Both classes need a source-content check, not a title-only prune.
- **2026-09-11** — Confirms the standing "check source content before pruning on title vibes" lesson from the other direction too: two HN-sourced items that looked like typical noise on title alone turned out to be substantive, verified via fetch, and were kept — an MIT AI researcher's own essay on "Robot-Use Agents" (cloud-hosted LLMs controlling physical robots) and a GitHub-hosted, arXiv-backed benchmark ("Egocentric Human-to-Robot Dexterous Hand Image Editing", 200M+ instances, HF-hosted dataset). The Facet-0 robotic-manipulation foundation-model paper (arXiv) was a third same-pattern keeper. HN is worth reading past the title in both directions, not just as a noise filter.
- **2026-09-11** — The Federal Register `term=robotics` D2D-spectrum-NPRM false positive (first logged 2026-09-07 against the **policy** scraper's output) also resurfaced in the **news** scraper's separate Federal Register pass under a `fedreg-news-*` id — the same false positive can independently reappear via either scraper since they hit the API with different endpoints/terms; drop it in both places rather than assuming a policy-side prune also covers news.
- **2026-09-09 (scheduled refresh)** — Default-lookback scrape (`scraper-news.js` 3-day, `scraper-policy.js` 7-day) surfaced 33 news + 3 policy candidates; kept 4 news, 0 policy. All 3 policy candidates were the exact same noise class already logged 2026-09-07 (D2D spectrum NPRM, Census mandatory-business-surveys PRA notice, Rural Development loan-modernization notice) — Federal Register re-surfaced the identical documents because the prior run's consolidation (`#196`) dropped them without marking them permanently excluded, so expect the same `term=robotics` false positives to resurface across runs until there's a persistent drop-list. New HN noise this run: an AI-explainer YouTube commentary channel (bycloud, "Robots Just Had Their GPT-3 Moment" — no primary research/funding hook, just trend commentary) and a hobbyist DIY-robotics YouTuber (James Bruton, "Making Tentacle Robots Useful") both dropped under the existing hobbyist/no-industry-hook rule. One genuine keeper came from HN itself despite the source being community-tier: "Robots 'protest' in Warsaw to demand regulation of AI and automation" (Notes from Poland) — a real robotics+policy news event, verified via the source article before keeping, confirming the standing lesson that a generic-sounding HN title still needs a source check before pruning.
- **2026-09-07 (backlog catch-up run)** — **The scheduled `scrape-news.yml`/`scrape-policy.yml` pipeline had been running fine since 2026-08-13 but nothing was merging the PRs it opened — 29 `auto/*` PRs piled up unreviewed, and `main`'s data went stale for ~2 weeks (frozen at 2026-08-26).** Before running the scrapers again, always check `gh pr list` for open `auto/news-*`/`auto/policy-*` PRs — if the scheduled workflow already ran today (check `gh run list --workflow=scrape-news.yml`), re-running the scraper duplicates work; the fix is to curate what's already scraped, not re-scrape. **Key mechanic:** each `auto/*` branch is cut fresh off `main`, not chained off the prior day's branch, so the *latest* open branch already contains the full accumulated backlog (this run: `auto/news-2026-09-07` had all 45 new-vs-main records, `auto/policy-2026-09-07` had all 3) — pull data straight from the newest branch (`git show <branch>:docs/data/news.json`) rather than replaying every intermediate PR. After curating and merging the catch-up PR, close the stale `auto/*` PRs as superseded (they'll conflict/no-op against the new `main` anyway). See issues.md/backlog.md 2026-09-07 for the process-fix proposal (auto-curation for easy noise classes, or chaining branches).
- **2026-09-07** — New Federal Register noise classes matched on `term=robotics` with zero robotics content: a D2D unlicensed-spectrum NPRM, a Census "Current Mandatory Business Surveys" PRA notice, and a Rural Development loan-modernization info-collection notice. Same "traceable but irrelevant" bucket as the fee-schedule/committee-renewal class already logged — the term match is broad enough that almost any regulatory notice can surface once.
- **2026-09-07** — New HN noise classes: hobbyist Show-HN projects using "robot" as branding/metaphor with no real robotics content (a macOS menu-bar app called "Slicky", a browser physics toy "Robot-duck soccer", a cellular-automaton demo "HexBOTs", a BEAM-robotics Elixir library, an "AI agents fighting" arena) and **stale year-tagged reposts** (a 2025 ScienceDirect hydrogels paper, a 2019 Wired handwriting-robot piece resurfacing — confirmed via web search it was 6+ years old despite reading as fresh from the title). Also confirmed via WebFetch that a plausible-looking industry story can be a general-AI piece mislabeled by URL slug (`newatlas.com/ai-humanoids/exclusive-google-ai` was actually a Google chatbot interview, no humanoid content) — check the fetched content, not just the URL path, before keeping a borderline HN item.
- **2026-09-07** — The same underlying event (Tesla's steering-wheel-free Cybercab robotaxi launch in Austin) produced 4 separate HN submissions this run (NYT, Tesla's own sign-up page, Business Insider, WSJ) — same "dedupe by story" pattern as the 2026-08-24 Games-story lesson below, but note one of the four (Tesla's own `tesla.com/robotaxi/interest` page) wasn't even news content, just a lead-gen page, and should be dropped regardless of dedup.
- **2026-08-24 (refresh run)** — **A single big story generates multiple independent HN submissions from different outlets on the same day — dedupe by story, not just by id.** The Beijing World Humanoid Robot Games 100m-sprint-record story was independently submitted to HN 5x this run, linking to Guardian, Reuters, AP News, ESPN, and NBC News respectively (all valid, all on-topic, all describing the same event). Kept the single most comprehensive version (AP News — covered both the 100m sprint and high jump, and its URL slug referenced the US angle) and dropped the other 4 as duplicates. Distinct from the existing "one story dominates the X list on a big news day" lesson below — this is the HN pass specifically re-submitting the same underlying event from N different publications.
- **2026-08-24** — X sweep (list: 22 posts harvested before the feed stalled per the known pattern below; bookmarks: 8 posts, stalled just as fast) surfaced only 5 robotics-adjacent hits combined, and none were citable as a new record — 1 was the same Games story already covered by the HN pass, and the rest (a company's conference-booth recap tweet, a vague "I was talking about this 10 years ago" founder anecdote, a "saw some robots outside HQ" observation, a home-robot mapping demo clip) had no discrete news hook (no funding, launch, or deployment event) to source a record from. Zero-net-new is a normal outcome for this step, not a sign the harvest failed — reconfirms the "confirmation/long-tail, not primary discovery" framing already logged for this source.
- **2026-08-14 (refresh run)** — **The PhysicalAI list membership drifts over time (103→129 members since 2026-07-27) and the owner may hand you the wrong list URL from memory** — this run the owner first pasted a different list ("Geo energy", 3 members) before the correct one was found. Don't trust a pasted URL or a previously-documented member count at face value: cross-check via `x.com/<owner>/lists` (shows all lists with live member counts) before harvesting, especially if the URL's list title doesn't match "PhysicalAI". The list id itself (`2061938532722311396`) was stable and matches the one already in Key facts.
- Claude-in-chrome connection failures are still transient — failed 3x this run (spaced across ~10 min of other work, not back-to-back) before connecting; kept working on the energy-company research in the gap rather than blocking on retries.
- The list feed can genuinely stall mid-scroll (not just the documented programmatic-scroll issue) — after ~5 scroll batches loading new posts fine, 4 consecutive `computer`-tool scrolls returned the identical view. A stray click on tweet content opened an image lightbox and navigated into the single-tweet view — scroll at a coordinate away from card content (e.g. near the right edge of the center column) to avoid this.
- Of ~30 list posts + 13 bookmarks harvested, only 2 were genuinely new industry news not already in news.json: LG/NVIDIA humanoid-robot MOU (Isaac GR00T, announced the same day) and NEURA Robotics' acquisition of Bosch Rexroth's ACTIVE Shuttle AMR line — both verified via primary sources (PR Newswire, tech.eu/neura-robotics.com) before authoring records. Reconfirms the 2026-07-27 lesson: X is a confirmation/long-tail source, budget accordingly.
- New non-scraper HN class this run: hobbyist/DIY robotics blog posts (e.g. "SideFX Houdini in a Robot Control Loop") and metaphorical essays using robot-adjacent titles ("A Swarm of Blood Robots" — actually about LLM agents doing genealogy research) — both read as on-topic from the title alone. Checked via WebFetch before pruning; the site's HN curation bar is industry/policy substance, not hobbyist or metaphorical use of robot-related words.
- **2026-08-14** — `docs/energy.html`'s curated dataset (58→59 entries) took its first addition since the June 2026 sourcing baseline: Gritt (solar-panel-install robots, $32M raised, TechCrunch, July 2026) added to the `solar` section, `REGIONS`, and `CANDIDATES`. `scripts/energy.test.js` is the regression gate for this file — run it after any manual edit to the embedded `SECTIONS`/`REGIONS`/`CANDIDATES` literals.
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

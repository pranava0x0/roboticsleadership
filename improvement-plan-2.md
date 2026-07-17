# Improvement Plan v2 — full site & codebase review (2026-07-16)

> Successor to [improvement-plan.md](improvement-plan.md) (2026-07-09). That plan's P0 (thesis + share) and P1 (cut + merge) shipped. Its still-open P2 (credibility) and P3 (perf) items are **absorbed here** — marked ↩︎P2 / ↩︎P3 — so there is exactly one active plan. The thesis in improvement-plan.md § The thesis stays canonical and stays the editing knife.
>
> Inputs: three parallel code audits (all 9 pages + IA · performance/payload · data pipeline), a live UX pass (desktop + 375px), crawler checks against the deployed site, and the ten goals below. Every finding carries a file:line or live-site receipt.

Work each item as a checkbox. Effort: **S** (<1h) · **M** (half-day) · **L** (multi-session). Ordering inside a workstream is priority order.

---

## The ten goals, mapped

| # | Goal (owner's words, compressed) | Where it's answered |
|---|---|---|
| 1 | THE spot for policy people on robotics | North star + WS2, WS4, WS6 (sources) |
| 2 | Tabs: organization, ordering, grouping | WS3 |
| 3 | Fewer clicks/scrolls to critical insights, easy path deeper | WS3, WS4 |
| 4 | Bots and web-connected chatbots find the site | WS1 |
| 5 | News that's exciting, trend-flagging — think news site | WS2 |
| 6 | Toolkits/overviews at multiple depths | WS4 |
| 7 | Perf / memory | WS5 |
| 8 | Save historical info / data sources | WS6 |
| 9 | Architecture extensible toward iOS/Android | WS8 |
| 10 | Page traffic analytics | WS7 |

---

## Diagnosis — the seven findings that matter

1. **The site is invisible to machines.** Every data surface is client-rendered: a no-JS crawler sees ~35% of index, ~15% of china.html, ~10% of news.html (measured: the live index yields 2,050 chars of text against ~19KB of HTML). LLM crawlers (GPTBot, ClaudeBot, PerplexityBot) don't execute JS — for them the scoreboard, every table, and all 743 news records **do not exist**. There is no `robots.txt`, no `sitemap.xml`, no `llms.txt` (all 404 on the live site), no JSON-LD, and no RSS feed. Goal 4 is currently at zero, and it drags goal 1 with it: a chatbot asked "who tracks US-China robotics policy?" cannot discover or quote this site.
2. **News is a log, not a news product.** 743 records render newest-first with zero hierarchy: a soft-robotics arXiv paper outranks "humanoid fight shuts down a car factory" because of scrape order. 54% of records have `summary == title` (the 442 HN items), so cards repeat their own headline. 20 records still carry `_requires_curator_review` — including a TechCrunch Disrupt ticket promo — and render on the live site. No lead story, no "why it matters," no trend flags, no digest.
3. **The IA fights the thesis.** 9 destinations: 6 flat tabs + 3 hidden under "More." The **US vs China scoreboard — the site's whole argument — sits at position 5**, behind Companies and Supply Chain; Themes ("the strategic spine") and Energy (the largest page, with an original policy instrument) are demoted to "More." At 375px the nav becomes a scroller where **Dashboard and News aren't even visible**. KPI cards aren't clickable — a staffer who sees "35 unicorns" has no path to the list. And **Methodology/About doesn't exist on any page** — the trust story of a "every record cited" tracker has no home (old plan flagged it; still unbuilt).
4. **One depth for everyone.** The 60-second layer exists (BLUF + exec brief — genuinely good), and the deep layer exists (dashboards). The middle is missing: no 10-minute primers, no printable one-pagers, no staffer toolkit, no "how to cite us." A first-time Hill visitor either gets 3 bullets or 28 metrics.
5. **The landing page weighs ~1.2MB raw.** `RT.loadAll()` pulls news.json (516KB) to render **5 cards** and policies.json (276KB) to compute **2 KPI counts**; sources+agencies are fetched and never destructured (docs/assets/app.js:26-36). themes.html needs 22KB and pulls >1MB. All 9 pages render-block on a 7-family/19-variant Google Fonts stylesheet although each theme uses ≤2 families (naked-sun: 1). `loadData` passes `{cache:'no-cache'}` (app.js:11-24), fighting the only caching GitHub Pages gives us (max-age=600). Wire cost is ~4-6× less thanks to gzip, but parse/memory cost is full price on every page view.
6. **History exists only in git.** No dataset snapshots, no per-record `captured_at` (only supply_chain/us_china have `_meta.captured_at`), curated edits overwrite prior values in place, only 110/743 news records have a Wayback `archive_url`, and 4 of 9 datasets are never archived (scripts/archive-sources.js:222). Meanwhile **two ingestion paths compete** (cron `auto/*` PRs vs the data-refresh skill) over whole-file JSON snapshots — the 21-PR pileup of 2026-07-16 (19 conflicted) will recur within a month if unresolved (backlog.md:54).
7. **Zero feedback loop.** No analytics of any kind, no Search Console. We don't know if anyone visits, what they read, which stories get clicked, or what queries land here. Every prioritization debate is currently taste vs. taste.

Also real but smaller: policy ingestion is Federal Register only (Congress.gov handler configured but disabled for lack of a free API key — sources.json:104-117; Federal Register is double-ingested into both news and policies); RSS news IDs carry a `Math.random()` suffix (scripts/scraper-news.js:76) that breaks ID stability for any future client; keystroke-time full-table re-renders on companies/policies/states (companies.html:207, policies.html:282, states.html:189); REFRESH.md's source list has drifted from reality.

---

## North star — what "THE spot" means operationally

**The live, cited, machine-readable scoreboard of the US-China robotics race — the site a staffer quotes and a chatbot cites.** Nobody else holds this ground: IFR is annual and paywalled, The Robot Report is news without policy, FAI/CSIS publish episodic PDFs, the AI Index is annual and AI-broad. Our wedge is **currency + citability + policy focus**.

Four tests, kept green:

- **The 60-second test** — a first-time visitor gets the thesis, the score, and this week's change without a click.
- **The citation test** — every number on the site can be linked, sourced, and dated by a staffer writing a memo (anchor + source + as-of).
- **The chatbot test** — ChatGPT/Claude/Perplexity, asked about US-China robotics or robotics policy, can find, read, and attribute the site.
- **The Tuesday test** — a returning reader finds something new, flagged as new, every week (else it's a report, not a spot).

---

## WS0 — Quick wins (one session, do first)

Highest leverage-per-hour on the whole plan; nothing here needs design work.

**Status: shipped 2026-07-16** — 6 of 8 done; analytics and Congress.gov deferred by owner decision (both need an account/key only the owner can create).

- [x] **robots.txt + sitemap.xml** in `docs/`. Static, handwritten (9 URLs). robots: allow all agents (explicitly fine with GPTBot/ClaudeBot/PerplexityBot), `Sitemap:` line. sitemap: the 9 pages, `lastmod` optional v1. **S** — done; `lastmod` uses each page's last content commit, not the data date. All three files confirmed 404 on production beforehand.
- [x] **llms.txt** in `docs/`: what the site is (thesis verbatim), what each page answers, and direct links to every `data/*.json` with one-line schema notes — LLMs can consume raw JSON if told what it is. Add `llms-full.txt` later via the bake step (WS1). **S** — done. Counts are stamped "as of 2026-07-16" rather than asserted live, since nothing in CI would catch their drift; **WS1's bake step should generate this file** so they stay true.
- [x] **Curation gate in validate.js**: fail if any published record carries `_requires_curator_review`/`_scraped` internal flags; sweep the 20 current offenders (drop non-robotics, tag + clear the rest). Prereq for WS2 and the API story; validate.js already gates deploy (pages.yml:31), so this makes noise unshippable. (Absorbs the existing backlog item.) **S-M** — done, but the estimate was 5× low: **108** flagged records, not 20 (20 news + 88 policies). Dropped 78 policies + 2 news; policies 155 → 77, news 743 → 741. Gate covers nested structured docs too; regression test in `scripts/validate.test.js`. **Caveat: the flag was never a reliable quality signal** — 29 records in the *unflagged* set are equally off-topic. See backlog.
  - **The gate alone was decorative — the ingestion half was missing** (found by Codex review, fixed same session). The scrapers had stopped setting `_requires_curator_review` on new records, so the gate rejected a flag nothing produced: it cleaned up legacy rows and blocked manual reintroduction, while every *future* scrape sailed through uncurated. The auto-PR templates still promised the flag, so this was a regression against the original design, not a new idea. Fix: all 5 record constructors mark again (`scraper-news.js` ×4, `scraper-policy.js` ×1), and `validate.js --allow-uncurated` lets the scrape workflows check shape while `pages.yml` stays strict. Curating a record now literally means clearing the flag; until someone does, the deploy fails. That is the invariant WS0 claimed and didn't have.
- [x] **News card hygiene**: when `summary === title`, render title only (kills the visible duplication on 54% of records — 403 cards). One conditional in `RT.renderNewsCard` (app.js:378-427). **S** — done; 403/741 confirmed.
- [ ] **Analytics live** (see WS7 for the choice): paste the snippet into the 9 heads + register Google Search Console with the new sitemap. **S** — **deferred 2026-07-16 (owner):** needs a GoatCounter account + site code, and Search Console verification. Both are owner-only actions. Goal 10 stays at zero until then.
- [ ] **Enable Congress.gov ingestion**: free API key as repo secret, wire the already-configured source (sources.json:104-117) through scraper-policy.js. The single biggest coverage gap for a policy site. **M** — **deferred 2026-07-16 (owner):** needs a free api.data.gov key; untestable without it, and at **M** it never belonged with the quick wins. Give it its own session with the key in hand.
- [x] **Make KPI cards links** (index KPI strip → companies.html filtered, policies.html, china.html…): the drill-down affordance goal 3 asks for. **S** — done, all 6. Note: `policies.html`'s status filter is single-valued, so "Signed OR In effect" isn't expressible as a URL; those KPIs link to the closest honest superset instead of a filtered view whose count wouldn't match.
- [x] **Kill dead fetches**: drop sources/agencies from `RT.loadAll()` call sites that discard them (index.html:158, themes.html:97) or slim loadAll per WS5. **S** — done by slimming `loadAll` to the 4 core datasets. Smaller than the plan assumed: **`sources.json` is not dead** (loadHeaderUpdated reads its `_meta.last_updated` for the header date). Real win is agencies.json (11KB) gone, plus sources.json going 2 fetches → 1 (see the `loadData` cache-stampede note in WS5).

## WS1 — Be findable by machines (goal 4)

The structural fix. Client-side rendering is the right dev model for this repo, but the *deployed artifact* must carry the content as HTML.

- [ ] **Bake step at deploy ("bake, not build")**: `scripts/render-static.js`, run inside pages.yml between validate and upload. It loads the JSON and injects rendered HTML into marked slots (`<!-- static:scoreboard -->` … ) in the shipped pages. The repo stays no-build for local dev (pages still hydrate client-side exactly as today; JS re-renders into the same containers). Renderers are already string-builders (renderNewsCard etc.), so most run in Node with a thin RT shim. Scope, in value order: **china.html** (BLUF + 20-4-4 tally + all 28 metric rows), **news.html** (latest ~50 cards), **index.html** (KPIs + top-5 news), **policies/states/companies** tables. Success bar: no-JS visible content ≥70% on those pages. **L — the flagship item of this plan**
- [ ] **RSS/Atom feed** `docs/feed.xml` (latest 50 news), generated by the same bake step (or standalone script at scrape time); `<link rel="alternate">` in every head. Feeds are how aggregators, newsreaders, and many bots watch a site; also the distribution rail for WS2's digest. **M**
- [ ] **JSON-LD**: `WebSite` + `Organization` on index; **`Dataset` markup for each of the 9 datasets** (name, description, temporalCoverage, license, `distribution` → the raw JSON URL) — this is what gets them into Google Dataset Search, which policy researchers actually use; `ItemList`/`NewsArticle` on the news page once the bake step exists. **M**
- [ ] **Data & downloads page** (`docs/data.html`): each dataset documented — what it is, record count, as-of date, schema sketch, download link, changelog pointer, **license** (recommend CC BY 4.0 — attribution is exactly what we want from chatbots; needs owner sign-off), and how to cite the site. Serves goal 4 (bots), goal 6 (the deepest rung), and ↩︎P2's "show our work." **M**
- [ ] **IndexNow/ping on deploy** (Bing/others) + verify Bing Webmaster alongside Search Console. **S**

## WS2 — News as a product (goal 5)

Make the feed read like an editor chose it — without pretending we have a newsroom. Everything here is computable at scrape time or one curator-minute per day.

- [ ] **The Brief — lead-story block** at the top of news.html and mirrored as index's "Recent activity" replacement: top 3-5 stories, each with a one-line curator "why it matters." Selection: curated `editor_pick: true` set during the daily refresh pass, fallback to a score (source weight × category weight × company-match × recency). The car-factory-shutdown story should never again rank below an arXiv paper. **M**
- [ ] **Signals strip — computed trend flags**: at scrape time, write `trends.json` — 7-day vs trailing-28-day counts per category/company/keyword; surface top risers as chips ("Humanoid-labor stories ×3 this week", "First appearance: <company>"). Honest, data-derived "new trends" flagging with zero LLM involvement. **M**
- [ ] **Same-story clustering**: normalized-title similarity at scrape time; collapse duplicates into one card + "also covered by N outlets" (which is itself a signal of story weight). **M**
- [ ] **Weekly digest** `docs/briefings/YYYY-WW.html`, generated from the week's top stories + signals + scoreboard deltas (revives the backlogged weekly-rollup idea); linked from the Brief and pushed through feed.xml. This is the artifact a staffer forwards. **M**
- [ ] **De-noise the cards**: retire the always-on "MEDIUM CONFIDENCE" pill from the default view (keep in compact/detail); reserve badge ink for category + sentiment. Curation gate from WS0 keeps junk out upstream. **S**
- [ ] **Source-mix rebalance**: 442 of 743 records are HN. Add think-tank/trade feeds (WS6) and weight the Brief toward them so the top of the site doesn't read like an HN mirror. **S (config) after WS6 sources land**

## WS3 — IA: tabs, ordering, click-depth (goals 2, 3)

- [ ] **Phase 1 — reorder the flat nav (zero structural change)**: **`Dashboard · News · US vs China · Supply Chain · Policy · Companies · More(States, Themes, Energy)`**. Rationale: news-site posture (goal 5) puts News at slot 2; the thesis tab stops hiding at slot 5; States rides with Policy via the in-page pointer until Phase 2 gives it a grouped home. One identical nav block across 9 files (md5-verified), so it's a 9-file find-replace. **S**
- [ ] **Phase 2 — two-tier nav** (the audit's Option B): **Dashboard · News · Scoreboard ▾ (US vs China, Supply Chain) · Policy ▾ (Federal, States, Toolkit) · Players ▾ (Companies, Themes) · About/Data**. Encodes reader intent (catch up → who's winning → what to do → who's who); replaces the bare `<details>` "More" with a real menu; pins Dashboard/News/Scoreboard in the mobile row so the two most important tabs are never off-screen at 375px. **M**
- [ ] **Energy → special report**: out of top nav, linked prominently from Dashboard + Themes as "Special report: Robotics × Energy." Resolves the old plan's open "decide energy.html's fate" without deleting the site's most elaborate page; its Prime Mover RFI remains reachable, and its 86KB stops competing for a nav slot. (If its data ever moves to `energy.json`, revisit.) **S (nav) — content reframe M**
- [ ] **Click-depth fixes**: KPI links (WS0); "28 metrics: 20-4-4" tally repeated as a static line on index under the thesis chart with a link to china.html (the single most quotable stat, currently JS-only on a page 1 click away); every chart/table keeps its `?focus=`/anchor deep link (↩︎P2 citable-stat anchors — extend to KPIs and scoreboard rows with a copy-link affordance). **M**
- [ ] **Cross-page redundancy trim**: china.html's "Supply chain & components" section becomes a summary + pointer into supply-chain.html (today they overlap wholesale); the production-trend chart stays on all three pages deliberately (it *is* the argument) but gets one shared "Source + Note" line (↩︎P2). **M**

## WS4 — Depth ladder: briefs, primers, toolkits (goal 6)

Three rungs, each one click from the one above:

- [ ] **Rung 0 — the 60-second brief** (exists: BLUF + exec brief + KPI strip). Add "**What changed this week**" — 3 bullets generated from the weekly digest data, so the rung is never stale. **S once WS2 digest exists**
- [ ] **Rung 1 — primers ("Start here")**: 3-4 curator-written, ~10-minute, print-friendly pages: *Robotics policy 101* (the landscape for a new staffer) · *The scoreboard, explained* (how to read US-vs-China claims honestly, incl. the density correction — ↩︎P2 concession-first framing) · *The state playbook* (what states actually control) · *The supply-chain chokepoints, plainly*. Static prose = also the best SEO/LLM food on the site (WS1 synergy). Linked from a "Start here" block on index. **L**
- [ ] **Rung 2 — the dashboards** (exist). Each gets the ↩︎P2 credibility kit: **Source + Note line under every chart** (**S-M**), **honest per-dataset freshness** in the header — show the *oldest* structured dataset feeding the page, not the newest news item (**M**), and the charts the old plan left open, as data permits (**M each**): china.html's density + deployment-stock bars with the concession-first density correction and index's cobot leading-indicator + policy-scoreboard visuals (↩︎P0), plus the state map, humanoid cost curve, sector-reliance, and subsidy-effect charts (↩︎P2).
- [ ] **Staffer toolkit page**: printable one-pagers (print CSS, no new tooling): the exec brief as a handout · top-10 cited stats with sources · glossary · "how to cite this site." The shareable artifact for goal 1's audience. **M**
- [ ] **Methodology / About page** (↩︎P2, still the top credibility gap — currently *unreachable because it doesn't exist*): who curates, sourcing rules (`sources[]` required, ≤2 per claim), what `edge`/`data_confidence` mean, update cadence per dataset, link to the repo as the public dataset. Lives in the About/Data nav slot (WS3 Phase 2). **M**

## WS5 — Performance & memory (goal 7)

Budget: **index first view ≤300KB wire / ≤400KB raw JSON parsed; LCP <2.0s on Fast 3G; no keystroke re-renders.** (Fonts cached cross-page are extra on first hit only.)

- [ ] **home.json** (~20KB): KPI aggregates + top-5 news + top-6 companies + theme teasers, written at scrape/bake time. index.html fetches it alone; full datasets load only on interaction pages. Kills ~780KB of the landing page's raw payload. **M**
- [ ] **themes.html: load themes.json only** (22KB); fetch companies/policies/news lazily inside `openTheme()` (first-click await — RT.loadData already caches). Best KB-per-effort fix on the site: −1MB. **S-M**
- [ ] **Split news.json**: `news-latest.json` (top 60, ~35KB) for every non-archive surface + monthly archive files (`news/2026-07.json`) fetched by news.html on demand (pagination already exists at PAGE_SIZE=20 — point it at chunks). Also fixes unbounded growth: at current rate news.json doubles yearly. **M**
- [ ] **Lookup files for cross-refs**: `companies-lookup.json` / `policies-lookup.json` (id→name, few KB) replace the 213KB + 276KB pulls that news.html does just to label pills (app.js:383-392). **M**
- [ ] **Per-theme font loading**: the FOUC boot script already knows the theme pre-paint — have it write a `<link>` for just that theme's ≤2 families (naked-sun: 1, and its serif is system — zero Google fonts). Drops a render-blocking 7-family stylesheet from every page (↩︎P3). **M**
- [ ] **Drop `{cache:'no-cache'}` from loadData** (app.js:11-24): let the 10-min HTTP cache work across page navigations; the data changes at most daily. Add `?v=<data-date>` from the bake step later if staleness ever bites. **S**
- [ ] **Fix the `loadData` cache stampede** (app.js:11-24, found 2026-07-16 doing WS0): the cache stores the *resolved* value, so two concurrent callers for the same dataset both miss and both fetch. `loadAll()` + `loadHeaderUpdated()` raced on sources.json and double-fetched it on every page. Cache the in-flight **promise** instead of the value — a one-line change that makes every concurrent call collapse to one request. Matters more once WS5 lazy-loads datasets from several places at once. **S**
- [ ] **Debounce (150ms) + event delegation** on the three keystroke-re-render tables (companies.html:207, policies.html:282, states.html:189): one delegated click handler on `tbody`, rebuild at most 6-7×/s while typing. **S**
- [ ] **A11y follow-through** (↩︎P3): 44px touch floor on `.btn`/`.filter-select` (backlog item — do site-wide once), visually-hidden data-table fallback per SVG chart. **S-M**

## WS6 — History & sources (goals 8, 1)

**History:**

- [ ] **kpi-history.json**: every refresh appends one row — date, tracked funding, unicorn count, install gap, scoreboard tally, news volume by category. Tiny forever (a few KB/yr), and it turns "the site keeps the score" into a plottable time series (future: sparkline row on index). Start now; charts later. **S**
- [ ] **Monthly dataset snapshots**, published: `docs/data/snapshots/YYYY-MM/`. ~1.2MB/month — years of headroom under Pages' 1GB. Researchers (and we) can diff the record; the Data page (WS1) links the snapshot index. **S-M**
  - **Must be committed, not baked** (caught by Codex review, 2026-07-16). The obvious version of this — "the bake step writes snapshots on the first deploy of each month" — cannot accumulate history and would quietly destroy it. `pages.yml` starts from a fresh checkout and uploads the mutated `docs/` as an artifact without committing anything, so each deploy's snapshot directory would contain only the current month, and replacing the artifact would take the previous months with it. Snapshots have to be **committed to the repo** (a monthly scheduled job, or a step in the data-refresh PR) so they exist in the checkout every subsequent deploy inherits. General rule for WS1's bake step: anything the bake step generates is **ephemeral, per-deploy output** — fine for rendered HTML, `feed.xml`, and `llms.txt`, which are pure functions of the committed data, and wrong for anything that must accumulate.
- [ ] **`captured_at` on every new record** + `_meta` envelope per dataset (goes with WS8's API v1 envelope — one breaking change, not two). Event date ≠ capture date; today only 2 of 9 datasets know the difference. **M**
- [ ] **Archive coverage**: run archive-sources monthly in CI with `--save-missing` default-on; extend the walker past companies/policies/news/themes to the 4 datasets it never visits (archive-sources.js:222). Target ≥80% of cited URLs having an `archive_url`. **M**
- [ ] **Provenance links**: records born from a research sweep carry `sweep_ref` → `data/research/<file>`; the audit trail exists on disk but is currently unqueryable from the record. **S going forward**
- [ ] **Resolve the dual-ingestion split** (prereq for everything above staying true): pick one — recommended: **cron workflows stop opening whole-file PRs and instead run scrape+validate+auto-merge to a `data/incoming` branch that the curated data-refresh consumes**, or simply disable cron PRs and put the data-refresh skill on the schedule. Either ends the snapshot-merge-reverts-curation failure mode (21 PRs, 19 conflicted, 2026-07-16). Also: de-duplicate Federal Register (ingest once, tag into news/policies from one fetch), fix `rss-*-random` IDs → hash of source_url (deterministic, API-safe), wire enrich.js into the scrape path so relations never depend on someone remembering. **M-L, decision first**

**Sources (goal 1's raw material — staged so curation load grows deliberately):**

- [ ] **Wave 1 (free APIs, config exists)**: Congress.gov (WS0), USAspending handler (stub exists, sources.json:140-152). **M**
- [ ] **Wave 2 (think tank / trade RSS)**: CSIS, CSET, Brookings, FAI, ITIF, RAND robotics/AI feeds (category: Research, weighted up in the Brief); IFR press releases; White House/OSTP; NIST. **M**
- [ ] **Wave 3 (state + international)**: OpenStates API for state bills (feeds states.html with live data instead of 5 curated records); EU (EUR-Lex/Parliament) and China (MERICS, TechNode, SCMP as translated proxies — direct MIIT needs a translation pipeline; park it). The thesis is US-vs-China and we currently ingest zero China-side sources. **L**

## WS7 — Analytics (goal 10)

- [ ] **Recommendation: GoatCounter now, GA4 only if a real attribution need appears.** Rationale against the house rules: free tier, **no cookies → no consent banner** (a policy audience is privacy-literate; CLAUDE.md's privacy stance applies), ~3.5KB script vs ~90KB gtag, public-dashboard option fits the "show our work" ethos. GA4 remains the swap-in if we later need acquisition/campaign reporting — the plan is one `<script>` line either way, so the decision is cheap to reverse. **S**
- [ ] **Google Search Console + Bing Webmaster** (with WS0's sitemap): not analytics, but the only way to see *which queries* bring policy people here — direct input to WS4 primer topics. **S**
- [ ] **Event goals, kept minimal**: outbound "Read original" clicks (which stories earn attention), dataset downloads (is the Data page working), copy-link uses on citable anchors (is the citation test passing), Brief→deep-dive clickthrough (is the depth ladder working). Review monthly against the four North-star tests. **S**

## WS8 — App-ready architecture (goal 9)

The JSON files already are the API; formalize instead of inventing. Explicit recommendation: **PWA before any native shell** — same codebase, installable on iOS/Android, offline briefing; revisit native only on real demand (push notifications / store presence).

- [ ] **API v1 (static, versioned)**: `docs/data/manifest.json` — schema_version, per-dataset {url, count, last_updated, sha}. Every dataset adopts the envelope `{meta:{schema_version, last_updated, captured_at, count}, data:[…]}` (one coordinated breaking change with WS6's `_meta`; bump renderers same PR). Deterministic IDs (WS6). Internal fields stripped at publish, enforced by validate.js (WS0). Energy data finally moves to `energy.json` so the 9th dataset exists for clients (and energy.html slims by ~48KB of inline literals). news chunking (WS5) doubles as the pagination story. **L**
- [ ] **PWA shell**: `manifest.webmanifest` + icons + a ~50-line service worker — cache-first for assets, stale-while-revalidate for `data/*`, offline fallback to the last-cached Brief. Result: "Add to Home Screen" on iOS/Android = the app, with zero new codebase. Lighthouse PWA pass is the acceptance test. **M**
- [ ] **Keep renderers portable**: RT.* renderers stay pure (data-in → HTML-string-out; the bake step in WS1 enforces this by running them in Node). If a native client ever happens (Capacitor wrapper or thin Swift/Kotlin over the JSON API), the data contract — not the site — is what it consumes. **ongoing discipline, not a task**

---

## How we'll know it worked

| Goal | Metric | Target |
|---|---|---|
| 4 | No-JS visible content on index/china/news | ≥70% (from 35/15/10%) |
| 4 | robots/sitemap/llms.txt/feed.xml live; Dataset markup validates | all green |
| 4 | Site cited by a web-connected chatbot for "US China robotics tracker"-class queries | spot-check monthly |
| 5 | Brief + Signals live; zero uncurated records (validate-enforced); weekly digest auto-publishes | all green |
| 3 | Any headline stat ≤1 click from landing; KPIs clickable; 20-4-4 tally visible on index without JS | all green |
| 7 | Index wire weight / LCP (PageSpeed, Fast 3G) | ≤300KB / <2.0s (from ~1.2MB raw) |
| 8 | kpi-history rows accumulating; monthly snapshots; archive coverage | ≥80% of cited URLs |
| 9 | manifest.json + enveloped datasets; Lighthouse PWA | pass |
| 10 | Analytics + Search Console live | 4 event goals reporting |
| 1 | The four North-star tests | reviewed monthly |

## Suggested sequencing

1. **Session A — WS0 entire** (quick wins; ends with analytics flowing and junk unshippable).
2. **Session B — WS1 bake step** for china/news/index + feed.xml + JSON-LD (the machine-readability core).
3. **Session C — WS2** Brief + signals + card hygiene follow-ons + weekly digest.
4. **Session D — WS3** nav Phase 1 + click-depth fixes; Phase 2 + Energy demotion once About/Data exists.
5. **Session E — WS4** methodology/About + first two primers + toolkit page (absorbing ↩︎P2).
6. **Session F — WS5** home.json + themes fix + news chunking + fonts (absorbing ↩︎P3).
7. **Session G — WS6** dual-ingestion decision + kpi-history + snapshots + source waves 1-2.
8. **Session H — WS8** API v1 envelope + PWA.

Re-sequence freely except: WS0 before WS2 (curation gate), WS1 bake before JSON-LD-on-news, WS6 envelope with WS8 API (one breaking change), About/Data page before WS3 Phase 2 (the nav slot needs a destination).

## Non-goals (unchanged from v1 unless noted)

- **No framework, no SPA, no backend.** The bake step is a deploy-time script, not a build system; local dev stays open-the-folder.
- **No native app yet** — PWA first; native only on demonstrated demand (new decision, supersedes the backlog's flat "Mobile app — web-first" note).
- **No LLM-generated narrative** — curator voice stays; trends/signals are counted, not written, by machines.
- **No new chart libraries; no paywall; no new top-level pages** beyond About/Data + Toolkit (both are depth-ladder infrastructure, not new surfaces).
- **Don't duplicate backlog data items** — FAI-report data work stays tracked in backlog.md; where a primer or chart needs it, do the backlog item first.

# Website Improvement Plan — 2026-07-09

Goal: make the site **clean, crisp, focused, and useful** for its actual mission — **influencing policy and educating people about the robotics industry**. Charts stay, but every chart must serve an argument.

Inputs: a full page-by-page review of all 8 pages + assets + data, benchmarked against FAI's *The State of Industrial Robotics* (Michael & Alden, 2026-06-17 — archived at `data/research/fai-state-of-industrial-robotics-2026-06-17.md`) and its companion pieces (Physical Intelligence Project announcement; Michael's "China's Robot Density Is Overstated").

Work each item as a checkbox; sections are ordered by priority. Effort tags: **S** (<1h), **M** (half-day), **L** (multi-session).

---

## Diagnosis (read this first)

The site's craft is good — design system, BLUFs, citations, no framework bloat. The problem is **strategy, not craft**:

1. **It's eight dashboards, not one argument.** The single most persuasive claim — *the U.S. leads in capital and labs, but China dominates deployment and production* — is stated in prose on the landing page and **never charted where a staffer will see it in 60 seconds**. The one chart that proves it (US-vs-China production trend) is buried three-quarters down `supply-chain.html`.
2. **The core page has no charts.** `china.html` — the thesis page — is 100% tables. Meanwhile decorative charts (bubble galaxy) live elsewhere.
3. **The site can't be shared.** Zero OG/Twitter meta tags on any page. Every link pasted into Slack/X/email renders as a bare URL. For a persuasion site this is the single highest-ROI gap.
4. **Freshness is overstated.** Every header says "Updated 2026-07-08" (news-scraper date) while the structured datasets are weeks older (themes 05-17, supply_chain 06-12, us_china 06-18, energy hardcoded 06-16). A journalist who checks will stop trusting the site.

What FAI's report does that we should steal:

- **A quotable, three-bullet executive summary** — every press summary of the report just repeats it verbatim.
- **Concession-first framing** ("China is still a secondary player… the greater concern is trajectory") — deflate the panic first, earn credibility, then land the warning.
- **Every figure carries a Source + methodological Note line**, and original analysis links to a public dataset ("we showed our work").
- **Leading-indicator logic** (cobots as proxy for AI-integrated robotics) — turns niche present-day data into a forecast.
- **Alliance framing** (non-Chinese supply chain incl. Japan/Europe), not US autarky.
- **Diagnostic, falsifiable numbers** (85%, 2%, 69%, 17.5%, 4× dysprosium premium), all footnoted.

---

## P0 — Make the argument visible (the thesis gets charts)

- [ ] **Promote the production-trend chart to the landing page and china.html.** `renderProductionTrend` (`docs/supply-chain.html:354-412`, section at `:170-176`) is the site's best evidence — US vs China vs RoW industrial units 2015–2025, solid/dashed historical/projected. Extract it into `app.js` as a shared renderer (same pattern as `RT.renderNewsCard`) and render it on `index.html` directly under the BLUF and on `china.html`. **M**
- [ ] **Give china.html its charts.** The scoreline ("X favor China / Y favor US / Z contested", `docs/china.html:146-150`) becomes a visual tally bar. Add a robot-density bar chart and a deployment-stock bar (China 2M operational robots, >4× Japan — IFR). Use Michael's density correction (IFR says 470/10k for China vs 295 US, but on the full 105M workforce China is ~167/10k — *below* the US) as a concession-first callout: it's exactly the credibility move FAI makes. Source: https://ameliakmichael.substack.com/p/chinas-robot-density-is-overstated. **M**
- [ ] **Restructure index.html as "the argument in 5 charts."** Sequence: BLUF → (1) production trend (who makes robots), (2) deployment stock / density with the honest correction (who uses them), (3) cobot share as the leading indicator (China >50% of shipments since 2023 — from `us_china.json`), (4) capital (keep the existing top-8 valuations chart — it shows what the US *is* winning), (5) policy scoreboard (bills in progress / in effect). Each chart gets a one-line "so what" under the title. The KPI strip today is all US-supply-side numbers (`docs/index.html:154-160`) — add one China-gap KPI so the strip reflects the thesis. **L**
- [ ] **Add OG/Twitter meta tags to all 8 pages + a share image.** `og:title`, `og:description`, `og:image`, `twitter:card=summary_large_image`, canonical URL per page. One static branded share image per page is enough to start (a rendered version of that page's headline chart is the stretch goal). This is the highest-leverage single fix for a site whose purpose is being shared. **S–M**
- [ ] **Write a one-page "Executive brief" section at the top of index.html** — three bolded, self-contained, quotable findings in FAI's style (e.g. ① US leads capital & frontier labs; ② China dominates production, deployment & cobots — the leading indicator; ③ the gap is trajectory, not today's chokehold). Keep each under 25 words so a staffer can paste them into a memo. **S**

## P1 — Focus: cut and merge (clean & crisp)

- [ ] **Cut the market-map bubble galaxy** (`docs/companies.html:109-121`, JS `:439-538`, CSS `:18-52`). Packed bubbles can't be compared, labels truncate to ~3 chars, and the directory table below does the real work. Replace with a simple per-segment summary bar (count + total valuation, US vs China split) — or nothing. **M**
- [ ] **Fix or cut "Tracked funding by year"** (`docs/index.html:85-90`). It measures *our tracking coverage*, not the market, and reads as an artifact. Either cut it (preferred — the valuations chart already covers capital) or relabel it explicitly as dataset coverage and move it to a methodology page. **S**
- [ ] **Cut the supply-chain financing bar chart** (`docs/supply-chain.html:212-217`, `renderFinancingChart:535`) — duplicates the per-category financing columns. **S**
- [ ] **De-duplicate state policy.** `policies.html` "State incentives" (`docs/policies.html:209-227`) and `states.html` "What's already on the books" render the same `level === 'State'` rows. Division of labor: **states.html = narrative + themes + (new) map; policies.html = the federal record**, with a link out to states. Render the state table once. **M**
- [ ] **Surface News as News.** The news feed — the site's highest-cadence content — lives inside `themes.html` behind the "More" overflow menu, and index's "all news" link points there (`docs/index.html:121-123`). Either restore a `news.html` or rename/split the nav so "News" is a top-level item. Keep themes as the curated-narratives page. **M**
- [ ] **Decide energy.html's fate.** Biggest page on the site (52KB, ~55 hardcoded company cards), weakest fit with the US-leadership thesis, and off the data pipeline (data is inline in the HTML; the `energy.json` README claims exists — `README.md:33` — does not). Options: (a) reframe and trim it hard around "robotics × energy is a US-leadership battleground" and move data to `energy.json`; (b) demote it from top nav to a linked sub-project. Do not leave it as-is: it dilutes the site's focus and can't be refreshed. **L**
- [ ] **Collapse supply-chain.html reference blocks.** Stakeholder map + key-figures table + US-sites table go behind a single `<details>` "Reference data" disclosure. The page keeps: chain map, shipments by class, production trend (until promoted), share-by-category, deep dives. **S**

## P2 — Credibility: earn the citation (useful)

- [ ] **Honest freshness.** Replace the single header "Updated <news-date>" with per-dataset "as of" dates (each page shows its own dataset's `last_updated`; the header shows the *oldest* structured dataset feeding that page, not the newest news item). The index lede's "refreshed weekly" claim must match reality or be dropped. **M**
- [ ] **Methodology / About page.** Who curates this, how records are sourced (`sources[]` required), what `edge`, `impact_tier`, `data_confidence` mean (rubrics), update cadence per dataset, how to cite the site, link to the GitHub repo as the public dataset. FAI's public companion spreadsheet is the model: "we showed our work" is itself persuasion. Also the natural home for the relabeled coverage chart. **M**
- [ ] **Source + Note lines on every chart.** Datawrapper-style: one-line source attribution (IFR, UN Comtrade, company filings…) + one-line methodological note (what's estimated, what's interpolated) under each figure. Several charts have honest sub-captions already — make it a standard component. **S–M**
- [ ] **Citable-stat anchors.** `?focus=` deep links exist for companies/policies/themes — extend the pattern: every KPI, scoreboard row, and chart gets an `id` anchor and a small copy-link affordance, so a staffer can cite one number. **M**
- [ ] **Add the missing purposeful charts** (each proves a claim already made in prose):
  - [ ] **State map** on states.html — the BLUF says "the map *is* the policy" and shows no map ("20+ states authorize sidewalk delivery robots"). Static inline SVG choropleth, no map library. **M**
  - [ ] **Humanoid cost curve** on themes.html — the "$20K humanoid" claim is unvisualized. **M**
  - [ ] **China foreign-reliance by sector** (imports 69% of automotive robots, 0% of textile — FAI Fig 3 style) on china.html — data already flagged in backlog's FAI section. **S–M**
  - [ ] **Subsidy effect** (2024 subsidies lifted 8 listed Chinese firms' margins by 0.4–11.9 pts — FAI Fig 8 style) on china.html "Capital & policy". **M**
- [ ] **Adopt concession-first framing in BLUFs.** Audit the BLUFs: lead with what the panic gets wrong (density overstated; no chokehold today; Japan/Europe — not China — dominate arms), then land the trajectory warning. Matches FAI's credibility structure and differentiates the site from doomer content. **S**
- [ ] **Alliance framing.** Where the site says "US vs China," check whether the honest unit is "allied (US+Japan+Europe) vs China" — especially supply-chain and arms-market content. FAI's core finding is that *Japan and Europe*, not the US, are China's rivals in industrial arms. **S**

## P3 — Performance & polish

- [ ] **Stop loading all 7 font families on every page** (`docs/index.html:11` and equivalents). Each page render-blocks on Google Fonts for all four themes' faces (~200KB+). Load only the active theme's two families — the FOUC boot script already knows the theme before first paint; have it write the `<link>`. **M**
- [ ] **Slim the dashboard payload.** `RT.loadAll()` (`docs/assets/app.js:26-36`) fetches ~1MB of JSON (news.json alone is 497KB) to render 5 news cards + 6 theme cards + 6 company cards + 2 charts. Generate a `news-latest.json` (top ~30) at scrape time for index/cards; lazy-load the full feed only on the news page. **M**
- [ ] **Accessibility fixes:** `.mm-panel-filter` is 24px (`docs/companies.html:31`) — below the 44px touch floor (moot if the bubble map is cut); SVG charts expose only a summary `aria-label` — add a visually-hidden data-table fallback per chart. **S–M**
- [ ] **Perf fix:** `backdrop-filter: blur(8px)` on the sticky `.e-jumpnav` (`docs/energy.html:27-29`) recomposites every scroll frame — violates DESIGN.md §10 (blur is only blessed on bounded cards). Remove (moot if energy is demoted). **S**
- [ ] **Content rot:** hardcoded "Status (May 2026)" (`docs/policies.html:200`); hardcoded "as of 2026-06-16" and "11" application areas in energy.html; README's phantom `energy.json` (`README.md:33`). **S**

---

## Explicit non-goals (keep it focused)

- **No new top-level pages** beyond News/About-methodology. The site has too many surfaces, not too few. (The backlog's Academia-tab idea stays parked.)
- **No new chart libraries.** Inline SVG has been sufficient; keep it.
- **No LLM-generated narrative.** Curator voice is a credibility asset here.
- **Don't duplicate the backlog's FAI data items.** The reducer/rare-earth/subsidy/ecosystem *data* work is already tracked in `backlog.md` ("Ideas from the FAI report"); this plan covers the *presentation* layer. Where a P2 chart needs that data, do the backlog item first.

## Suggested sequencing

1. **Session 1 (share + thesis):** OG meta tags, executive brief, promote production-trend chart to index + china.html, china.html scoreline visual. This alone changes what a first-time visitor takes away.
2. **Session 2 (cut + merge):** bubble galaxy, funding-by-year, financing bar, state de-dup, News nav fix.
3. **Session 3 (credibility):** freshness honesty, methodology page, source/note lines, citable anchors.
4. **Session 4+ (new charts + energy decision + perf).**

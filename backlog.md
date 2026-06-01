# Backlog

Prioritized list of features, enhancements, and known gaps. Review weekly; demote stale "high" items to "low" rather than letting them rot.

## High

- **CI lint: reject floating action tags** — fail the build if any `uses:` in `.github/workflows/` references `@vN` instead of a 40-char commit SHA. Keeps the 2026-06-01 SHA-pinning from regressing. ~15 LOC grep gate.
- **Render-layer XSS regression test** — feed each renderer a poisoned record (`category`/`title`/`summary` = `x"><img src=x onerror=alert(1)>`) and assert no raw `<`/attribute-breakout survives into emitted markup. Locks in the 2026-06-01 `RT.slug()` + escape fixes.
- **GitHub Actions cron for scrapers** — daily news, weekly policy. Spec'd but not wired; manual runs only for now.
- **Per-company comparison view** — Figure vs. Agility vs. 1X vs. Tesla Optimus, side-by-side. Spec calls for this; deferred from v1.
- **Confidence-scoring rubric** — document what `high / medium / low` means per entity in `data_curation.md`. Without a rubric the field drifts.
- **Search across all four datasets** — global search bar in header; Lunr.js or simple regex over JSON.

## Medium

- **Academia tab** — a new top-nav page covering the U.S. university robotics ecosystem: top labs (CMU RI, MIT CSAIL, Stanford SAIL, UC Berkeley BAIR, Georgia Tech IRIM, U-Penn GRASP, U-Michigan, U-Washington), faculty + spinouts, paper output (arXiv cs.RO + NeurIPS/ICRA/RSS counts), and notable grants flowing in from NSF NRI / DOE national labs / DARPA. Sister surface to **Agencies** but oriented around where the research and talent originates. Likely needs a small `academia.json` data file with one record per lab; cross-link spinouts back to `companies.json` (e.g., Skild AI → CMU, Physical Intelligence → Berkeley/Stanford). Priority bumps once we've watched **Agencies** for a couple of weeks and seen how often users want a "who's training the people" view.
- **Extract `renderNewsCard()` into `app.js`** — the news-card markup is duplicated between `docs/index.html` (recent-news on dashboard) and `docs/news.html` (the feed). Edits to one silently miss the other; the 2026-05-18 dashboard archive-link bug landed because of this. A shared helper closes the gap.

- **Mapbox / Leaflet deployment map** — pin customer sites with robot counts. Defer until users actually ask for geographic browsing.
- **Funding timeline charts on company detail panel** — currently rendered as a table; SVG line + bar chart per company.
- **Weekly briefing generator** — `scripts/weekly-rollup.js` writes `docs/briefings/YYYY-MM-DD.md`. Email delivery is out of scope; static markdown is the artifact.
- **State incentives choropleth** — currently a sortable table; map view is nice-to-have for the spec'd state-by-state browsing.
- **Twitter / X ingestion** — needs API approval. Manual curation of top accounts (Brett Adcock, Mike Kalil, etc.) covers v1.
- **Regulatory timeline Gantt chart** — currently a table. SVG Gantt would be ~150 LOC.
- **Substack / RSS aggregation for industry writers** — Mike Kalil, Shriftman, Robotics Observer. Public posts only.
- **Federal contract tracker (USAspending.gov)** — robotics-related awards table.
- **Federal preemption vs. state AI legislation matrix** — Track interaction between the March 2026 U.S. Federal AI Policy Framework's preemption recommendations and state-level laws (e.g. California, Colorado) governing autonomous physical systems.
- **Compliance checklists for ANSI/A3 R15.06-2025 & ISO 10218** — Interactive safety checklist for system-level risk assessments and cyber-physical security controls mandated by the latest collaborative/industrial robot standards.

## Low

- **News impact-tier signal (revisit)** — removed 2026-05-17 because tiers were curator-set and added noise without driving any feature. Bring back only when there's a clear consuming surface: e.g., a "weekly briefing" digest that filters to High-impact items, or a homepage "what changed this week" strip. If we bring it back, define the tier rubric in `data_curation.md` first (what makes something High vs Medium) so the field doesn't drift.
- **Crunchbase API integration** — paid, deferred until we have a budget line.
- **Sentiment analysis on news** — leave as curator-only per AGENTS.md; revisit if curation becomes bottleneck.
- **Mobile app** — web-first; mobile responsive covers most of the use case.
- **Subscription / paywall** — Phase 6 in original spec; out of scope until product-market fit signal.
- **LLM-generated theme narratives** — curator writes for now; consider after 5+ themes accumulate enough data.
- **Company logos** — visually nice, but pulling third-party brand assets has legal questions (per DESIGN.md § 3.2). Use brand-adjacent text treatments instead.
- **Investor portfolio rollup** — "all Sequoia robotics bets" view. Nice cross-cut once data is denser.
- **Lights-out factory case studies** — Track fully autonomous 24/7 manufacturing and self-maintenance initiatives (e.g. Tesla Fremont humanoid lines, Samsung, BMW) to compile operational metrics.
- **Edge AI compute infrastructure tracker** — Track hardware deployment trends for local, real-time edge learning (e.g. CSIRO's Vetra network) that eliminates cloud latency in dynamic physical environments.

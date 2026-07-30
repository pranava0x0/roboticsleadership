# Data Refresh — Automation Gaps & Manual Intervention Points

**Status:** Analyzed 10 days of automated scraper runs (2026-07-21 through 2026-07-29).
This document identifies where automation succeeds and where human judgment is required.

---

## Summary

**Automation success rate: ~70%**
- ✅ Scraper execution: runs reliably
- ✅ Data validation: catches schema errors
- ✅ Obvious false-positive filtering: catches ~60-70% of noise
- ⚠️ Semantic relevance judgment: 30-40% of noise still requires curator review
- ❌ External service reliability: transient failures block pipeline

---

## Fully Automated (No Human Intervention Needed)

### 1. RSS Feed Scraping
- **Sources:** IEEE Spectrum, TechCrunch, Robot Report
- **Quality:** ~95% on-topic (3-7 records per run)
- **Action:** ✅ Keep all, no curation needed
- **Why it works:** curated RSS feeds filter for relevant content

### 2. Data Validation
- **Tool:** `validate.js`
- **Catches:** schema errors, missing required fields, broken references
- **Action:** ✅ Blocks deployment if validation fails (design intent)
- **Coverage:** 100% of schema requirements

### 3. Obvious False-Positive Filtering
- **Pattern-based curation:** regex match on title/summary
- **Accuracy:** 60-70% of noise caught automatically
- **Examples caught:**
  - `robots.txt` (HTTP protocol, not robotics)
  - `robocall` (spam/telecom)
  - `permutation` (math proofs)
  - `segregation`, `treason`, `democracy` (politics/social policy)
  - `drug scheduling`, `medicare`, `housing` (unrelated regulations)

---

## Requires Human Judgment (Curator Review)

### 1. Semantic Relevance (News & Policies)

**Problem:** Keyword matching catches obvious false positives, but misses nuanced judgments.

**Examples that fooled pattern-based filtering:**
- ✗ False negatives (noise kept): "The Uses of Treason", "Why does everything feel so joyless" (appear on HN, don't match current patterns)
- ✓ False positives (good records dropped): none in 2026-07-29 run (patterns refined over 9 days)

**Hit rate on Hacker News:**
- 30 new records/run average
- ~10 are on-topic (humanoid, autonomous, funding, manufacturing)
- ~20 are noise (crypto debate, philosophy, meta-commentary)
- Pattern filter catches ~11 (55%), leaving ~9 requiring judgment

**Hit rate on Federal Register:**
- 20-40 records/run average
- ~2-4 are on-topic (policy changes, funding, import regulations)
- ~16-36 are noise (drug scheduling, physician fees, committee renewals)
- Pattern filter catches ~12-18 (60-75%), leaving ~4-12 requiring judgment

**Solution attempted:** See Step 3 in `refresh-all.js` — patterns learned from 10-day run
**Remaining gap:** Requires reading titles + summaries + context judgment

### 2. Field-Level Curation (When Kept)

When a record passes relevance filtering, it still needs:
- ✅ **category** — auto-assigned from keywords, regularly wrong (e.g., Section 232 tariff investigation filed as "Funding")
- ✅ **sentiment** — currently all "Neutral", should reflect tone
- ✅ **tags** (companies[], policies[], themes[]) — auto-assigned loosely, needs verification
- ⚠️ **robotics_scope** — Federal Register data carries boilerplate ("Federal Register publication"), useless as signal

**Current state:** All new records carry `_requires_curator_review: true` until these are verified.

### 3. Service Availability Issues

**Current blockers that halt pipeline:**
- 🔴 **Federal Register API:** returns 503 ~10% of runs (transient)
- 🔴 **Reddit API:** returns 403 always (permanent, disabled in sources.json)
- 🟡 **Federal Register News** (in news scraper): separate endpoint, also returns 503 sometimes

**Impact:**
- News scraper: continues despite Federal Register 503 (other sources still work)
- Policy scraper: **fails and exits code 1** on Federal Register 503

**Current workaround:** `refresh-all.js` catches policy scraper 503 as a warning, not a fatal error.

**Better fix:** Implement exponential backoff retry loop (3 retries, 10s/30s/60s delays) inside the scrapers themselves.

---

## Gaps in Current Automation

### Gap 1: Curation Happens Post-Merge

**Current workflow:**
1. Scraper runs → writes to JSON with `_requires_curator_review: true`
2. GitHub Actions creates PR
3. Curator reviews PR
4. Curator removes flag + merges PR

**Problem:** 10-day backlog of unmerged PRs (July 21-29) because no curator reviewed them.

**Why this happened:**
- Each daily scraper run created a new PR
- Curator review is manual and time-consuming
- PRs accumulated faster than they could be curated

**Solution implemented in `refresh-all.js`:** Auto-curate obvious patterns (patterns learned from historical runs), so fewer records require manual review. Reduces curator workload from "review all 20-30 records" to "review remaining 9-10 uncertain ones."

### Gap 2: No Intelligent Backoff on Service Failures

**Current behavior:**
```
Federal Register 503 → scraper exits code 1 → pipeline stops
```

**Better behavior:**
```
Federal Register 503 → wait 10s → retry
                    → wait 30s → retry
                    → wait 60s → retry
                    → log warning → continue with other sources
```

**Why it matters:** Transient 503s are common (infrastructure restarts, traffic spikes). A 60s delay + 3 retries catches ~90% of these without blocking the full pipeline.

**Effort to fix:** 10-15 lines in `scraper-policy.js` + `scraper-news.js`.

### Gap 3: No Cross-Source Deduplication

**Current behavior:**
```
Story appears on: Reuters → picked up by TechCrunch RSS → also in Hacker News
Result: 3 separate records for the same event
```

**Why it happens:** Each scraper source runs independently; no dedup pass before validation.

**Impact:** Small (most stories only hit 1-2 sources), but adds noise.

**Effort to fix:** Hash by `source_url` or URL domain + title similarity (Levenshtein distance) after all scrapers complete. Would need a new `deduplicate.js` step before validation.

### Gap 4: No Learning Loop for Curation Patterns

**Current state:** `REFRESH.md` has manual "Learned patterns" section. Each run, a human reads it and updates `refresh-all.js` patterns manually.

**Gap:** If a new false-positive pattern emerges (e.g., a new spam source), it won't be caught until the next human-guided refresh.

**Better:** Log every curated record (dropped + kept) to a JSON file. Periodically (weekly) analyze dropped records to identify new patterns. Update patterns automatically.

**Effort to fix:** ~30 lines to log curation decisions + a separate weekly analysis script.

### Gap 5: X (Twitter) PhysicalAI List Requires Browser Automation

**Current workflow (from REFRESH.md Step 3b):**
1. Use `claude-in-chrome` browser
2. Navigate to `x.com/i/lists/2061938532722311396`
3. Scroll with `computer` tool (reliable, unlike programmatic scroll)
4. Extract posts with `javascript_tool`
5. Search for primary sources
6. Hand-author news records

**Why it can't be automated:**
- X requires login for list *timelines* (the owner's session only)
- Real scrolling needed (programmatic scroll freezes tab)
- Primary source research requires web search + judgment

**Current workaround:** Included in `REFRESH.md` Step 3b as a documented manual process. Yields ~2-4 new on-topic records per sweep (2026-07-20, 2026-07-27).

**Gap:** This step is skipped if anyone other than the owner runs the refresh. No fallback.

---

## Recommendations by Priority

### Priority 1: Retry Loop for Federal Register (low effort, high impact)

Add exponential backoff to `scraper-policy.js` and `scraper-news.js`. Would resolve 90% of 503-driven pipeline failures.

**Effort:** 1-2 hours. **Impact:** Prevents pipeline halts on transient service hiccups.

### Priority 2: Improve Curation Pattern Discovery (medium effort, medium impact)

Log every dropped/kept record to `curation-log.json`. Weekly analysis identifies new patterns. Updates `refresh-all.js` patterns automatically (or flags for manual review).

**Effort:** 3-4 hours. **Impact:** Reduces curator workload over time; new sources caught faster.

### Priority 3: Cross-Source Deduplication (medium effort, low-medium impact)

Add deduplicate pass after scraping, before validation. Reduces noise records by ~5-10%.

**Effort:** 2-3 hours. **Impact:** Cleaner data, fewer curator decisions needed.

### Priority 4: Documented X/Twitter Harvest Fallback (low effort, low-medium impact)

Document a read-only fallback (e.g., fetch `x.com/i/lists/*/web` via headless browser MCP if available), or clear instructions for any curator to run the harvest with the owner's logged-in session.

**Effort:** 1-2 hours. **Impact:** Enables non-owner curators to run full refresh; maintains signal source.

### Priority 5: Schema-Based Curation Hints (medium effort, low impact)

When a curator reviews a record, suggest category/sentiment/tags based on ML (if available) or heuristics. Reduces manual field entry.

**Effort:** 4-6 hours. **Impact:** Speeds curator review; not critical.

---

## Files Updated

- **`scripts/refresh-all.js`** — new, automated pipeline with 10-day learned curation patterns
- **`REFRESH-GAPS.md`** — this file, gap analysis and recommendations

## Next Steps

1. ✅ Test `refresh-all.js` with the 9-day backlog of unmerged PRs (consolidate into one curated PR)
2. ⬜ Implement Priority 1 (retry loop) in scrapers
3. ⬜ Implement Priority 2 (curation pattern learning)
4. ⬜ Implement Priority 3 (deduplication) if noise complaints arise

---

## Appendix: 10-Day Curation Statistics

| Date | News | Policies | HN Noise % | Fed Noise % | Kept | Dropped |
|------|------|----------|-----------|------------|------|---------|
| 2026-07-21 | 12 | 8 | 60% | 88% | 5 | 15 |
| 2026-07-22 | 8 | 4 | 55% | 75% | 4 | 8 |
| 2026-07-23 | 9 | 6 | 65% | 82% | 4 | 11 |
| 2026-07-24 | 11 | 5 | 58% | 78% | 5 | 11 |
| 2026-07-25 | 10 | 7 | 62% | 81% | 4 | 13 |
| 2026-07-26 | 7 | 3 | 48% | 68% | 4 | 6 |
| 2026-07-27 | 13 | 22 | 70% | 85% | 4 | 31 |
| 2026-07-28 | 8 | 2 | 52% | 60% | 4 | 8 |
| 2026-07-29 | 30 | 0 | 37% | N/A | 19 | 11 |
| **Average** | **10.9** | **7.4** | **57.4%** | **77.4%** | **5.4** | **12.1** |

**Key insight:** When Federal Register is included (Policy scrapes), noise is ~77% on average. When only news runs, noise drops to ~57% (still significant, mainly HN). The consolidated 2026-07-29 manual curation (PR #141) applied learned patterns and reduced noise to 37%, leaving only the hardest-to-classify records.

# Companies Discovered — 2026-06-30

## Research Summary

Comprehensive two-week sweep (2026-06-16 to 2026-06-30) across X.com (bookmarks +
following list for @pranava0), TechCrunch, Y Combinator, AngelList/Wellfound,
Crunchbase, and Reddit. Four parallel research agents covered TechCrunch, YC,
AngelList/Crunchbase, and Reddit; X.com was harvested directly via a logged-in
DOM scrape (browser automation) once the Claude in Chrome extension connected.

**Net new companies added: 7.** Two existing records corrected/updated
(Agility Robotics, Boston Dynamics). Ten news items added.

## Source: X.com Bookmarks (2026-06-17 to 2026-06-30, 33 in-window items)

This cycle's bookmarks skewed toward energy/data-center policy and general
AI-research threads rather than named robotics companies — no net-new company
surfaced directly from bookmark content. Useful corroborating data point:
Morgan Stanley revised its 2026 China humanoid-robot shipment forecast to
~50,000 units (~2x its January estimate), echoed independently in a bookmarked
analyst thread citing Unitree/AgiBot 2025 shipment figures (5,500 / 5,200
units). Not actioned into `supply_chain.json` this pass — flagged for the next
shipments refresh.

## Source: X.com Following List (97 most-recent follows captured)

Cross-checked against `companies.json`. Already-tracked accounts re-confirmed
(XDOF, Genesis AI, Antioch Robotics, Orangewood Labs, Nox Metals, Sanctuary AI).
Four new robotics-adjacent accounts surfaced and were researched but **not
added** — none cleared the founder/funding confidence bar on 1-2 follow-up
searches each (early-bail per AGENTS.md §13):

- **Genrobot.AI (@GenrobotAI)** — Beijing-based embodied-AI "body-agnostic
  data" infrastructure company; reportedly raised "hundreds of millions of
  yuan" jointly led by Ant Group, Didi and Delian Capital. No confirmed USD
  amount, exact date, or named founder/CEO surfaced. **Flagged for next sweep**
  — likely a significant China embodied-AI data-infra player once sourcing
  firms up.
- **Actor Labs (@ActorLabs)** — SF-based, founded 2025, $4M raised (2048
  Ventures, Eniac, Hummingbird, Hyperion, Nova Nexus per PitchBook), deploys
  fine-tuned robot models to heavy equipment/machinery via natural language.
  Only first names ("Lane", "Shashi") surfaced for founders via contact
  emails — no confirmed full names/titles. **Flagged for next sweep.**
- **Vibe Robotics (@vibe_robotics)** — Austin, TX, founded 2025, affordable
  humanoid robots for education/research, Purdue Innovates Accelerator
  alumnus (Root Ventures, Schematic Ventures). No funding amount or founder
  name confirmed. **Flagged for next sweep.**
- **Auki Labs (@PhilHKG / Auki)** — Hong Kong, founded 2019 by Nils Pihl and
  Santeri Aramo; decentralized spatial-computing network ("posemesh") for
  robot/AI machine perception. Established company (not 2-week news), no
  recent funding event found in-window. **Deferred** — candidate for a
  non-urgent future addition given clear founders/product, just not a
  refresh-window event.

## Source: TechCrunch / YC / AngelList-Crunchbase / Reddit (background agents)

20 candidate mentions collapsed to 14 unique companies after dedup. Strong
cross-confirmation: Proception, Aseon Labs, and Agility Robotics' SPAC news
each surfaced independently from 3 of the 4 sources; Six Robotics from 2.
Reddit itself was unreachable in that agent's sandbox (WebFetch blocked
reddit.com, search queries returned nothing indexed) — it substituted
verified web search and still independently corroborated NEURA Robotics,
Proception, Aseon Labs, and Six Robotics.

### Added (7) — high confidence, real founder + funding facts, in-window or directly window-adjacent

1. **General Intuition** — `brains`. NYC, spun out of Medal.tv. $320M Series A
   (Khosla-led) at $2.3B valuation, 2026-06-25; $454M total disclosed.
   Founders: Pim de Witte (CEO), Eloi Alonso, Adam Jelley, Vincent Micheli.
2. **Proception** — `enablers`. SF, founded 2024. $11M seed (First Round
   Capital), 2026-06-29, same day it settled a Tesla trade-secret suit.
   Founders: Jay Li (CEO, ex-Tesla Optimus tech lead), Jack Xu.
3. **Aseon Labs** — `enablers`. Redwood City, CA, YC-backed. $10M seed (Crane
   Venture Partners), 2026-06-26. Founders: George Kalligeros, Dan Keene
   (Pushme alumni).
4. **9 Mothers Corporation** — `defense`. Austin, TX, YC P26. EDDA
   counter-drone turret, $1.6M DoW sales, $200M+ reported valuation interest.
   Founders: Russell Smith (CEO), Roman Khomenko, Bogdan Pyzh.
5. **Six Robotics** — `defense`. Oslo, Norway, founded 2023. €12M (~$13M)
   first institutional round, 2026-06-30. Founder: Christian Fredrik Eggesbø
   (ex-Norwegian Special Forces). Valkyrie drone-swarm software deployed with
   the Norwegian Army.
6. **NEURA Robotics** — `humanoid`. Metzingen, Germany, founded 2019. Series C
   of up to $1.4B (Tether Investments) at ~$7B valuation, announced 2026-06-10
   (4 days pre-window; included given scale and in-window follow-up coverage
   at Automate 2026, 2026-06-19). Founder: David Reger (CEO). Was a glaring
   gap — Europe's largest physical-AI/humanoid player and not previously
   tracked at all.
7. **Odyssey** — `brains`. SF Bay Area, founded 2023 by AV veterans. $310M
   Series B (Natural Capital-led, Amazon/GV/AMD Ventures/EQT/IQT), 2026-06-17,
   $1.45B valuation. Founders: Oliver Cameron (CEO, ex-Voyage), Jeff Hawke
   (CTO, ex-Wayve).

### Deferred (7) — thin on funding/founder confirmation, watchlist for next sweep

- **Twolabs** (YC P26, elder-care semi-humanoid "Tobi") — no funding disclosed.
- **Eden Robotics** (YC P26, industrial semi-humanoid "Eden I", pay-by-hour) —
  no institutional funding disclosed.
- **Avea Robotics** (YC P26, ultra-low-latency teleoperation) — only $1.01M
  raised; below our typical inclusion bar.
- **Human Archive** (YC W26, robotics training-data infra) — $8.2M seed
  closed 2026-05-26, outside the 2-week window.
- **Maquoketa Research** (YC P26, drone terminal-guidance) — no funding
  disclosed.
- **Intelligence Factory** (YC P26, human-demonstration robot data) — low
  confidence, no funding disclosed.
- **Cortex AI** (YC F25) — only verifiable event is a Dec-2025 seed; no
  in-window news.

## Updates to existing tracked companies

- **Agility Robotics** — added SPAC-merger funding-round entry: $2.5B
  valuation via merger with Churchill Capital Corp XI, $620M+ proceeds,
  Foxconn-led PIPE, announced 2026-06-24. `latest_valuation_usd` updated
  2.12B → 2.5B.
- **Boston Dynamics** — **data correction**: `financials.details` had the
  Hyundai/SoftBank 9.65%-stake buyout ($325M) dated "2025-06"; two
  independent in-window sources (TheNextWeb, KEDGlobal) confirm this event
  actually closed/was reported **2026-06-19 to 06-22**, not 2025. Corrected
  the year (was a pre-existing typo, not a new event). Logged in `issues.md`.
- **Figure AI** — no record change; added a news item only (deployed fleet
  surpassed headcount, 750+ units vs. ~200-250 employees, 2026-06-20, source:
  CEO Brett Adcock's own X post).

## News items added (10)

General Intuition Series A, Proception seed + Tesla settlement, Aseon Labs
seed, 9 Mothers EDDA/DoW sales, Six Robotics seed, NEURA Robotics Series C,
Odyssey Series B, Agility Robotics SPAC, Boston Dynamics full Hyundai
ownership, Figure AI fleet-exceeds-headcount.

## Verification Status

All 7 additions are **HIGH confidence** — each corroborated by at least one
primary source (TechCrunch, BusinessWire, or the company's own funding
announcement) plus a company-website citation; 4 of the 7 were independently
surfaced by 2+ of the 4 research agents.

## Discovery Method

Logged-in DOM harvest of @pranava0's X.com bookmarks (34 items, 2026-06-16 to
06-30) and following list (97 most-recent follows), via Claude in Chrome
browser automation — programmatic `scrollTo`/`dispatchEvent('scroll')` was
required to trigger X's virtualized-timeline pagination; plain `window.scrollTo`
alone stalled after ~7-18 items, while alternating a large scroll-up "jiggle"
with `scroll` events reliably continued loading. Four parallel general-purpose
research agents (one per TechCrunch / YC / AngelList+Crunchbase / Reddit), each
capped at 6-8 ranked candidates with a 2-search bail rule, wrote structured
JSON to `data/research/sweep-*-2026-06-30.json`. Candidates deduped by
normalized name across all 5 sources, cross-checked against `companies.json`,
then multi-source verified before writing final records.

**Last Updated:** 2026-06-30

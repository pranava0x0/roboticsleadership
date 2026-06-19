# Companies Discovered from X.com Activity — 2026-06-19

## Research Summary

Comprehensive sweep of @pranava0 recent X.com **bookmarks** (121 captured) and
**following list** (84 most-recent follows captured). Goal: catch new robotics /
physical-AI founders and companies before aggregators index them.

**Net new company added: 1 (XDOF).** The rest of the robotics/physical-AI signal
was already in `companies.json` from prior sweeps — this run mostly confirms the
database is current.

## Source: X.com Bookmarks (recent)

26 of 121 bookmarks matched robotics/physical-AI keywords. Notable:
- **Jim Fan (NVIDIA)** — ENPIRE: 8 Codex agents driving a fleet of robots + GPUs (research demo)
- **Fabric Foundation (@FabricFND)** — "Humanoid Anatomy" map of the humanoid value chain (research/media, not a company)
- **Sam D'Amico (@sdamico)** — on West Magnetics (@westmagco) electric-stack bottlenecks → **already in DB** (Westmag, $11M a16z seed)
- **kuz (@kylekuzma)** — thesis: AI-applied industrial throughput, autonomous defense + space robotics
- **Prashant Garg** — Global Automation Atlas (18k tasks, 124 countries) — useful theme/source, not a company

## Source: X.com Following List (recent)

Company / org accounts among recent follows and their DB status:
- **XDOF (@xdofai)** — robot teleoperation-data infrastructure — **NEW → added**
- Genesis AI (@gs_ai_) — already in DB (commit 8791137)
- Orangewood Labs (@OrangewoodLabs) — already in DB
- Antioch Robotics (@antiochrobotics) — already in DB
- Agility Robotics (@agilityrobotics) — already in DB
- Westmag (@westmagco) — already in DB
- Tensordyne (@TensordyneInc) — AI datacenter **inference silicon** (~$176–211M raised, ex-Recogni); **out of scope** (general AI compute, not physical AI). Flagged, not added.
- Juno (@JunoAgent) — "$JUNO" token / "Institute for Zero-Human Companies"; crypto-AI agent project, **not robotics**. Skipped.
- Fuse Energy, Boltz Bio, Arc Institute, Midjourney, Lighthouse, Pluralis — out of scope (energy / bio / AI-image / immigration / decentralized-AI).

Robotics *individuals* newly followed (signal, not companies): Wenli Xiao (CMU/ex-NVIDIA GEAR),
Ritvik Singh, Zhenjia Xu & Zhou Xian (Genesis AI), Yunlong Song, Moritz Reuss, Philipp Wu (XDOF),
Chris Paxton (Agility), Sergey Levine (Physical Intelligence), Furong Huang, Grace Zhang.

## New Company Added to companies.json

### XDOF — `enablers`
- **What:** Data pipelines, teleoperation systems, and tooling to train robot foundation models. Three-tier data model (bespoke teleop, generalized teleop, egocentric human-performance). Released **ABC-130K**, "world's largest open-source bimanual robot manipulation dataset" (130K trajectories, 195 tasks; with UC Berkeley, CMU, MIT, Amazon).
- **HQ:** Emeryville, CA. **Founded:** October 2024.
- **Funding:** $70M, emerged from stealth 2026-06-17. Investors: Thrive Capital, a16z, Spark Capital, Lux, WndrCo.
- **Team:** Philipp Wu (CEO), Fred/Yide Shentu (CTO), Nemo Jin (COO). Ex-Covariant, Tesla, Meta; UC Berkeley GELLO authors. ~60 employees, ~20 customers incl. frontier AI labs.

## Verification Status

✓ **HIGH confidence** — XDOF: multiple independent outlets (TechCrunch, SiliconANGLE, theaiinsider) within 24h of launch; founders, funding, investors, HQ corroborated. Series designation ("Seed") inferred from stealth-emergence framing — outlets did not name the round.

## Front-page valuation audit (data correctness)

While incorporating XDOF, audited the top-8 valuations the dashboard front page renders.
Two were stale/mislabeled and are now fixed:

- **Anduril Industries** — was **$14B** (a 2024-08 Series F) → corrected to **$61B** (Series H, $5B, Thrive Capital + a16z, 2026-05-13; up from $30.5B Series G, 2025-06). Added both rounds; `total_funding_usd` 3.7B → 11.3B. The entry's prose already cited $61B but the structured field had never been updated. Sources: CNBC, Bloomberg.
- **Skild AI** — $14B valuation was correct but the round was mislabeled **Series B** → corrected to **Series C** ($1.4B led by SoftBank, with Nvidia); replaced homepage-only source with the Businesswire/TechCrunch announcement.

Effect on front page: Anduril now correctly ranks #1 by valuation (above Figure AI $39B);
2026 tracked funding 5.58B → 10.58B (the real $5B Series H). Unicorn count unchanged (27).

## Discovery Method

Logged-in DOM harvest of @pranava0 bookmarks (scroll + dedupe) and following list
(most-recent-first), keyword-filtered for robotics/physical-AI, cross-checked each
candidate against `docs/data/companies.json`, then multi-source web verification on
the one net-new entity before adding.

**Last Updated:** 2026-06-19

# Companies Discovered from X.com Activity — 2026-07-06

## Research Summary

Sweep of @pranava0's X.com bookmarks (~24 recent items, jiggle-scrolled) and
following list (~100 recent follows, scrolled via mouse wheel). Goal: catch new
robotics/physical-AI founders and companies before aggregators index them.

**Net new companies added: 3** (Galbot, Alloy Robotics, Nori Robotics). One
candidate (GenrobotAI) was researched but held back — required schema field
`founded` isn't publicly disclosed (Crunchbase lists it as "obfuscated"); revisit
if a source surfaces a founding date. One candidate (Auki Labs) was researched
and correctly excluded as out of scope.

## Source: X.com Bookmarks

Mostly non-robotics this cycle (AI/data-center/energy/finance content dominated
the user's recent bookmarks). One weak signal: a viral video from **Li Zexin
(@XH_Lee23)** touring Midea's smart AC factory (robotic transport, 6-second
assembly cycle) — Midea is already tracked (KUKA's parent company); no new
entity here.

## Source: X.com Following List

Robotics/physical-AI signal found among recent follows:
- **Galbot** (@GalbotRobotics) — **NEW → added.** Beijing embodied-AI/humanoid startup, $800M raised across 3 rounds, $3B valuation (Dec 2025).
- **Alloy Robotics** (@AlloyRobotics, founder Joe Harris @_joe_harris_) — **NEW → added.** Sydney-based robotics-data infrastructure startup, $4.5M pre-seed (Blackbird Ventures, Sept 2025).
- **Nori Robotics** (@NoriRobotics) — **NEW → added.** NYC, YC-backed ($1,288 bimanual home robot), founder Antonio Sitong Li, 4 employees.
- **GenrobotAI** (@GenrobotAI, genrobot.ai / "Jianzhi Robotics" / 简智机器人) — researched, **held back**. Beijing embodied-AI data-infrastructure company, undisclosed funding from Ant Group/Didi (Jun 2026), founders identified (Chen Jianxing, Li Xinglong, ex-Momenta/Zhenji Intelligence) but founding year not public in any source checked — fails the schema's required `founded` field. Revisit next sweep.
- **Auki Labs** (engineer Phil Shaw @PhilHKG, auki.ai) — researched, **excluded**. Fundamentally a spatial-computing/decentralized-perception protocol company (the "posemesh"), founded 2019 Hong Kong, ~$19M raised since 2019. Robotics involvement (in-house demo robot + Unitree G1/Go2-W integration) is secondary, not a core robot product — doesn't fit the tracker without force-fitting.
- **Zenno Astronautics** (@zennospace, founder Max Arshavsky) — "The space superconductor company," first private superconducting magnet in orbit. Adjacent to our magnet supply-chain coverage but is a space-propulsion company, not robotics — **out of scope**.
- **RMFG** (@rmfgdotcom) — general contract metal fabrication (laser cutting, welding) — not robotics-specific — **out of scope**.
- **ahad** (@ahadj0, ex-SpaceX/AWS/Amazon) — individual bio says "building autonomous robots," no company name disclosed — **no entity to add**.
- **Junyao Shi** (@JunyaoShi) bio references **Sunday Robotics** — already tracked (added 2026-06-12).

## New Companies Added to companies.json

1. **Galbot** — `map_category: humanoid`. Sources: The Robot Report, CaproAsia.
2. **Alloy Robotics** — `map_category: enablers`. Sources: TechCrunch, Blackbird Ventures.
3. **Nori Robotics** — `map_category: service`. Sources: Y Combinator, norirobotics.com.

Full researched records (including the held-back GenrobotAI and skipped Auki
Labs, with reasoning) are in `data/research/companies-discovered-2026-07-06-batch-a.json`
and `-batch-b.json`.

# Refresh notes, 2026-09-25

Audit trail for the scheduled full-site refresh. Not served. Companion files: `sweep-wide-2026-09-25.json` (Sonnet wide-search agent output, unedited) and `refresh-2026-09-25-dropped.json` (scraped candidates dropped and why).

## X PhysicalAI list (list id 2061938532722311396), signed-in Chrome

- Chronological scroll: 23 posts covering about 24 hours (2026-09-24 to 09-25). Mostly commentary and demos; UBTECH Kazakhstan hub was the one new item.
- `list:` search, funding/M&A keywords, since 2026-09-19: 18 posts. Leads: Feather Robotics stealth exit, Vesoma stealth exit, Cognex/RealSense, UK humanoid funding roundup (Humanoid $152M Series A, Automata $45M Series C), Wayve/Mercedes production agreement, Heidi Health raise (not robotics).
- `list:` search, policy keywords, since 2026-09-19: 15 posts, mostly reinforcement-learning "policy" false positives. Useful: Robots for America at the Dirty Jobs Summit (2026-09-24), Asimov open-sourcing its Asimov 1 locomotion policy, NVIDIA GTC Berlin session promos.
- Bookmarks were not harvested this run (list only, per the task file).

## Outcome of the candidates

Added as records: IFR World Robotics 2026, Cognex/RealSense, Qualcomm/PickNik, Amazon Greenwood plant, Toyota 400,000-robot plan, Feather, Vesoma, UBTECH Almaty, AgiBot/Chimelong, Counterpoint H1 2026, Skild S1 self-play, XPeng IRON line, UBTECH U1 deliveries, Apptronik gear-shortage remarks, GENISOM Series B, South Korea 2027 robot AI program, China MIIT humanoid standards draft, Pentagon 1260H list (backfill), FDA robotic-surgery draft guidance (news + policy), PitPro, KAIST RAIBO2, Agility wheels.

Held back (see backlog.md, 2026-09-25 block): Humanoid (UK) company record, Automata, Mecka AI, Mach Industries, Cosmic Robotics, Asimov, O-ID, Tesla Optimus Gen 3 app-leak, Unitree Dex5-S.

## Scraper pass

`scraper-news.js --days=5`: 60 candidates (IEEE 1, TechCrunch 11, Robot Report 10, HN 37, Federal Register 1); 4 kept in place, 6 replaced by hand-authored records with primary sources (Feather, Cognex, Qualcomm, Toyota, IFR, Amazon), 50 dropped (TechCrunch Disrupt promos, HN AI-doom essays and `root`/`human*` stem matches, hobbyist Show HN, dev-tooling). `scraper-policy.js --days=10`: 3 candidates; FDA guidance kept, an NCRPA/ODVA consortium notice and a premerger early-termination notice dropped. Reddit still returns 403.

# Handoff — R&D build session, 2026-10-26 (usage limit hit)

> **Status 2026-10-27:** every step under "Left" shipped in the R&D PR (built in worktree rd-research-sweep-harvest-60face). Kept as the record of the adjudications.

Branch: jam/robotics-rd-research-7a615f (worktree robotics-deployment-moat-f786b3). Nothing committed yet. Do NOT commit `.claude/agent-cap` or `.sessions/`.

## Done
- Research: breadth + depth jsonl per tab in this dir (models, world-models, benchmarks, rd-areas, datasets, compute, components; `*-depth.jsonl` override breadth; last line `_notes` = discrepancies). X list leads in `x-list-leads.md`, 13 data-bearing images in `x-diagrams/`.
- `improvement-plan-3.md` (reorg plan: Option B hub tabs + section bar, four phases) and `backlog.md` section "Added 2026-10-26".
- `REFRESH.md` Step 3b note on the windowed X search + DOM export technique.
- An Opus agent was building `docs/rd.html` + `docs/data/rd.json` + `app.js` renderers (`RT.renderRd*`, `RT.initSubTabs`), bake `rdSlots()`, `scripts/rd.test.js`, validate.js registration, nav link "R&D" after "US vs China" on all pages, sitemap + llms.txt lines, interaction tasks. Check `git status` to see how far it got; run `node scripts/validate.js && npm test && node scripts/render-static.js && python3 scripts/interaction-cost.py`.

## Adjudications already decided (binding for rd.json)
See the brief in the session transcript; key ones: Argon 87% ERQA vendor-reported, no eesel.ai comparisons; VPP2 only live RoboDojo numbers; RLDX-1 only arXiv 86.8%; Natura-1 weights unknown; Helix 2.5 56% vs own 9% baseline; Spirit removal unconfirmed; RoboDojo live leader GO-3 Nano Preview 61.90/56.42% (2026-10-26) vs paper table Hy-Embodied-0.5-VLA 8.80% (2026-07-03); LIBERO/BEHAVIOR/X2Real/RoboHarm metric definitions per benchmarks-depth; BOM shares shown side by side (Morgan Stanley / McKinsey / BofA), Tesla hand actuator count "not disclosed", screws per teardown only, 36Kr supplier claims snippet-only.

## Left
1. Verify/finish the R&D page build (above) and review it (375px, dark mode, JS off).
2. Rename Draft EO → "Proposed policy investment areas": `docs/physical-ai-action-plan.html` title/meta/og/h1-strap/footer line, nav label on all 12 pages (short label e.g. "Investment areas"), `docs/llms.txt:55`, `README.md:18`, `docs/energy.html:343` link text, `docs/policies.html:275`; body keeps EO form; link it from policies.html as a section; keep `#eo-*` ids (interaction tasks use them).
3. SEO: no page has JSON-LD today — add WebSite + Dataset (per data file) + Article/WebPage JSON-LD, refresh llms.txt (add rd.json, R&D page, rename EO line), sitemap lastmod.
4. CLAUDE.md learning note (X export technique is in REFRESH.md; add the "one window per batch, save between" lesson to CLAUDE.md agents section).
5. `npm test`, validate, bake check, interaction-cost; commit (no AI trailers); push; PR; 2–3 review rounds (Claude /code-review + Codex bot); merge.

# AGENTS.md — How to work in these repos as an AI agent

> Base file for every project in this folder. Project-specific `AGENTS.md` files extend this with file maps, settings keys, and project-specific conflict cheatsheets. When project conflicts with base, project wins — it's the local source of truth.
>
> Companion files: [CLAUDE.md](CLAUDE.md) is the *what* (principles, architecture, editorial rules); [DESIGN.md](DESIGN.md) is the *look*.

---

## Read these first, in order

Before touching code, read:

1. **[CLAUDE.md](CLAUDE.md)** — universal principles + project-specific intent and editorial rules. The "Project intent" and any project-specific notes are load-bearing for every change.
2. **[DESIGN.md](DESIGN.md)** — visual + content system. Touch this before changing how data is presented.
3. **`backlog.md`** (or `BACKLOG.md`) — what's next. Pick from here; don't invent work.
4. **`issues.md`** — what's broken. Check before reporting a bug as new.
5. **`security.md`** — supply-chain advisory log. **Refresh if `Last updated` is > 7 days old before any `npm install` / `pip install` / dep upgrade.** Also fetch `https://pranava0x0.github.io/vibe-coding-security/llms-ctx.txt` and surface any matching advisory before suggesting an install.

---

## The Explore → Plan → Code → Verify loop

Documented in detail in [CLAUDE.md](CLAUDE.md). Concretely inside any repo:

- **Explore.** Use `grep`, `find`, or an Explore agent to find relevant code. Most projects here are small enough that a single read of the main module + the data schema covers ~80% of the surface.
- **Plan.** For anything beyond a one-line fix, present 2–3 approaches with pros/cons before writing code. Changes that touch the data schema, the editorial rules, or the visual identity ALWAYS need a plan surface — they reshape the product.
- **Code.** Edit existing files first; only create new files when the task genuinely requires it. No new helpers for one-shot operations.
- **Verify.** Run the test suite. Use the feature in a browser (or invoke the CLI) before declaring done.

**Per-item cadence in multi-item sessions.** Surface design questions up front, then do **tests + docs + commit per item**, not batched at the end. Catches issues early and produces a clean bisect history.

---

## Verifying changes

Default verification matrix (project-specific `AGENTS.md` should override with concrete commands):

| Change kind                    | Run                                                  |
| ------------------------------ | ---------------------------------------------------- |
| Schema edit                    | Schema-validation tests (Pydantic / zod / etc.)       |
| Seed / data edit               | Refresh script + data-integrity tests                 |
| Shared vocabulary change       | Match-frontend-to-backend test                        |
| Frontend (markup / styles / JS) | E2E / Playwright suite, or manual UAT in browser     |
| Connector / fetcher            | Connector unit tests + a small live integration run  |
| Anything substantial           | Full test suite (`pytest` / `npm test` / `vitest`)   |

**For UI changes**, also run the app locally and click through the affected views — type checks and unit tests verify code correctness, not feature correctness.

**For data changes**, diff the canonical output (`docs/data/*.json` or equivalent) and skim the diff before committing. A 30-second skim catches regressions tests miss (especially around character encoding, pretty-printer drift, and unintended fields).

---

## Common tasks

### Adding a record / claim / row (most common)

1. Open the seed file (typically `data/seed/<entity>.json` or equivalent).
2. Append one record with: stable `id`, real `source_url`, verbatim content, today's `captured_at`, and any required category from the canonical list in the schema module.
3. Run the refresh script (validates + writes the build output).
4. Run the relevant data-integrity test to confirm.
5. Commit. Seed JSON and build output `data/*.json` move together — never in separate commits, or a future bisect lands on a broken state.

### Adding a feature

1. Confirm it's on `backlog.md`. If not, propose adding it before building.
2. Sketch the smallest version that closes the user need end-to-end.
3. Build that. Add tests alongside. Use the feature in the browser / CLI.
4. Commit at the natural boundary (per module, per fix, per doc update).

### Adding a new vocabulary item (theme, category, tier)

This is a schema change. **Don't do this casually.** Steps:

1. File a `backlog.md` entry first explaining the gap.
2. Add to the canonical constant in the schema module.
3. Mirror in any frontend mirror constant (the test that asserts parity catches drift here).
4. Add any color / icon / label token to the design system (light + dark variants).
5. Migrate any existing records that should map to the new entry — or intentionally leave them.
6. Run the full test suite — drift-safety tests should catch a missed mirror.

### Adding a connector (per-source scraper)

1. Subclass the project's `Connector` base class.
2. Register in the connector index module.
3. Implement `fetch_records()` / `normalize()` / `cache_key()`.
4. Set `run_order` so enrichment connectors run *after* their producers.
5. Schema-validate emitted records; tests catch any new field that the schema's `extra="forbid"` would reject.

---

## Token economy — patterns that waste tokens

These patterns recur. Each costs real money; avoid them by default.

### 1. Don't spawn an Explore/subagent to understand project structure
For tasks like "add a news item" or "fix a CSS bug," a subagent costs 5–10k tokens in orchestration overhead. Replace with 1–2 targeted Bash calls:
```bash
node -e "const n=require('./docs/data/news.json'); console.log(n[0])"
node -e "const t=require('./docs/data/themes.json'); t.forEach(x=>console.log(x.id))"
```
Only spawn a subagent when exploration genuinely spans 10+ files or requires synthesis.

### 2. WebSearch results are usually enough — don't fetch full pages
For "search for X and add news," the WebSearch snippet contains all facts needed (funding, investors, date, summary). Only `WebFetch` a URL if a required field is absent from the snippet. Cap at **1 URL fetch per entity**. Never fetch secondary analysis articles unless explicitly requested.

### 3. Check enum/ID constraints BEFORE writing data
Writing data with an invalid `themes`, `category`, or `primary_use_case` forces a fix-and-re-commit cycle. One lookup first:
```bash
node -e "const t=require('./docs/data/themes.json'); t.forEach(x=>console.log(x.id))"
node -e "const n=require('./docs/data/news.json'); console.log([...new Set(n.map(x=>x.category))])"
```
Then write. Never guess enum values from memory or context.

### 4. Read only the section of a file you need
For a CSS fix touching `@media (max-width: 640px)`, don't read 1,400 lines. Use `offset`+`limit` on Read, or `grep -n` to find the relevant block first:
```bash
grep -n "max-width: 640" docs/assets/styles.css   # find the line, then read ±50 lines
```

### 5. Suppress verbose command output
The merge script prints ~30 lines per branch. 11 branches = 330 lines of context. Pipe to a summary:
```bash
node scripts/merge-all-branches.js 2>&1 | tail -15
```
Only read full output when a step fails.

### 6. Batch ToolSearch loads
Load all needed tools in one call, not one-at-a-time:
```
ToolSearch({ query: "select:WebSearch,WebFetch,preview_start,preview_screenshot,preview_resize" })
```

### 7. Two screenshots are enough for a UI fix
Mobile (375×812) + desktop. Don't take 4+ screenshots to verify a CSS change. One mobile shot confirms the fix; one desktop shot confirms no regression.

### 8. Read one representative file for a shared pattern
When multiple files use the same component (e.g. three HTML pages all using the same `<table class="data-table">`), read one. The others are the same structure — reading all three adds tokens without adding information.

### 9. Failures in long-running scripts are expensive — prevent them, don't recover from them
Each time you re-run a script like `merge-all-branches.js`, its full output re-enters context. One avoidable failure (e.g., invalid enum written to data) causes the whole script to run twice. Validate inputs *before* triggering the script, not after it fails.

### 10. Early expensive operations compound through the whole session
Every tool result (merge output, web fetch bodies, agent responses) stays in context and is re-fed as input tokens on every subsequent turn. An expensive mistake at the start of a session is the most costly place to make one — it multiplies. Keep the first few turns cheap; do the heavy work late, or in a fresh session.

---

## Research-agent economy — buy findings, not inventory

Added 2026-06-12 after a 6-agent research session (~368K subagent tokens, ~60% of returned entities shipped). The agents all succeeded; the waste was in what they were asked to buy. These rules target yield, not just cost.

### 11. Size the agent's shopping list to the shelf, not the warehouse
Decide what the destination surface holds BEFORE prompting (e.g., "the table shows 3–4 companies per category"), then ask for exactly that many — "the N most important, ranked" — never "4–8 with full detail." This session, agents returned ~83 companies; the page shipped 44. Over-collection is researched, returned, re-read in context, then discarded: paid for three times, used zero.

### 12. Partition entities across parallel agents explicitly
When fanning out N research agents, assign each entity to exactly one agent and tell the others: "Figure, Tesla, Unitree are covered by a sibling agent — mention them only by name, do not research them." This session three agents independently re-derived Figure's Series C and BotQ details (~15–20K tokens of duplicate work).

### 13. Put the validator's bar in the prompt, with an early-bail trigger
Tell research agents the exact required fields (the schema's `required` list: founded, sources, funding…) AND a bail rule: "if 2 searches don't surface the required fields, mark `skip: true` and move on — a record missing them will be discarded." An agent researching its way to a thorough skip (XDOF this session) is the most expensive way to learn nothing shippable exists. A fast negative is a finding; a slow one is a leak.

### 14. Big agent results go to disk, not into the conversation
For multi-agent research waves, have each agent `Write` its JSON to `data/research/<topic>.json` and return only: counts, 3-line summary, file path, and anything surprising. The orchestrator reads files once, selectively, at authoring time. Returning 10–20K tokens of JSON per agent into the main context (this session: ~70–80K total) re-bills that payload as input on every later turn — the single largest hidden cost of the session.

### 15. Cap per-claim sourcing at collection time
Two source URLs per claim is the publishing standard here; agents returning 5–6 per company inflate both their output and the orchestrator's context. Say "max 2 sources per claim, prefer primary" in every research prompt.

### 16. Verify renders with DOM counts before screenshots
One `preview_eval` that counts rendered sections (`document.querySelectorAll('.cat-block').length`) costs ~100 tokens and catches a blank or half-rendered page; a screenshot costs 1–2K tokens and is blank at any scroll position anyway (see issues.md, 2026-06-12). Screenshot once at scroll-0 for final visual confirmation only. This check — not the test suite — is what caught a TDZ bug that silently blanked half a page while all tests passed.

### 17. Seed-then-spawn is the proven shape — keep it
~5 cheap WebSearches to fix the structure → precise agent prompts with the exact output JSON contract embedded → zero parse/retry loops. Every agent this session returned valid structured output on the first attempt because the contract was in the prompt. Never spawn research agents before the structure is known; never accept prose when you need records.

### 18. Company-research partitioning, validated again (2026-07-06)
A 2-vs-3 split across 2 agents with fully disjoint entity lists, the exact required-field bar, and an early-bail rule embedded in each prompt cost ~143K total tokens for 5 researched entities (2 shipped, 1 correctly held back for a genuine schema gap — no public founding date — 1 correctly skipped as out-of-scope). Zero duplicate-entity research, zero fabricated fields. That's ~28.6K tokens/entity, well under the ~61K/company baseline a prior sweep hit when duplicate spend went unchecked (see [[research-sweep-agent-economy]] in memory). Confirms rules #12–13 work when the prompt actually states them.

### 19. Match code-review agent fan-out to diff size, not to a flat "high effort" default
Running `/code-review` at high effort (8 finder angles × a verify pass per surviving candidate) on an ~11-file, ~1,260-line diff — in practice one ~70-line render function plus three JSON records — cost ~980K subagent tokens across 14 agent calls. Three of the eight finder angles independently rediscovered the exact same two bugs (a division-by-zero and a negative-slice edge case in the same function): real convergent validation, but at 3x the token cost of finding each bug once. A single manual read of the new function (no agents at all) surfaced both bugs before any finder was spawned. Lesson: size review fan-out to the diff, not to whatever effort level was asked for by default — a diff this small likely only needed a manual pass or a 2–3 angle review to catch the same headline findings; save the full 8-angle preset for diffs that are genuinely large or touch many files.

### 20. Grep `data/research/` and `backlog.md` before commissioning web research (2026-07-09)
The FAI-report research agent (~92K tokens) was spawned to find and read a report whose full extract already lived at `data/research/fai-state-of-industrial-robotics-2026-06-17.md` — indexed in backlog.md's "Ideas from the FAI report" section, discovered only after launch. The agent still earned part of its keep (report TOC, 9-figure inventory, rhetorical analysis, companion pieces — none of which the local extract had), but the hard numbers were already on disk. Before any "go read external source X" agent: grep `data/research/` and `backlog.md` for it first, then scope the agent to only the gap. Counterpoint from the same session: the site-review Explore agent (~161K tokens, 8 pages + assets + data) was consumed end-to-end in the resulting plan — a full-site review is exactly the 10+-file synthesis fan-out is for.

### 21. Run the mechanical checks *before* spending the review agent (2026-07-16)
Sibling to #19: that one sizes the fan-out, this one sequences it. The WS0 review (**one** agent, not the 8-angle preset — #19's advice, followed) cost ~151K tokens / 49 tool calls / ~10 min and earned it: 3 real defects, all of which I'd have shipped. But 2 of the 3 were *mechanically* checkable, and I only wrote those checks after it reported — a duplicate key in an object literal (`node -e` over the MIME map, 5 lines) and a `sitemap.xml` `lastmod` disagreeing with `git log` (10 lines). Only the third needed real reasoning: a regression test that covered the pure predicate while the gate's *wiring* could be deleted, which no script would ever find. So before spawning the reviewer, run whatever mechanically compares an artifact to its source of truth — parse it, diff its claims against git or the data, grep for duplicate keys. The agent's budget then goes to judgment instead of to what a 10-line script finds for ~0 tokens. Not an argument against review agents: 3 for 3 were real.

---

## What NOT to do

- **Don't paraphrase quoted content.** Quote verbatim into the `statement` / `quote` / `body` field. Tests catch obvious markers ("they claim that…").
- **Don't add a record without a real `source_url`.** Schema rejects it; reviewers reject it harder.
- **Don't LLM-classify subjective editorial calls.** Stance, sentiment, framing — these are curator-only. A wrong tag undermines the whole product.
- **Don't aggregate to a "trust score" / "credibility index" / "greenwashing score."** Show the data; let users judge.
- **Don't introduce a new framework / library / build tool** mid-project. If the stack is vanilla JS + Pydantic + Playwright, stay there. Adding React / Vue / Svelte / Webpack contradicts the static-first principle and adds maintenance debt the project doesn't pay back.
- **Don't touch `docs/data/*.json` (or equivalent build output) directly.** Edit the seed and re-run the refresh script.
- **Don't expand scope inside a fix.** A bug fix doesn't need surrounding cleanup; a one-shot operation doesn't need a helper. Note future cleanup in `backlog.md` and move on.
- **Don't loosen invariants quietly.** If a rule has a test guarding it, that test was written because someone got burned. Read the rationale before relaxing it.
- **Don't `--no-verify` to bypass a hook.** Fix the underlying issue. Hooks exist because someone got burned.
- **Don't add yourself as a co-author.** Never include `Co-Authored-By:` for any AI agent in commit messages — not Claude, Copilot, or any other tool. Commits are owned by the human who reviews and ships the work. The `claude.coauthor` git config is set to `false` in these repos; honor it.

---

## Repo norms

- **Read before edit.** Always. Even if you read the file earlier in this session.
- **Type hints on every Python function.** No `any` in TypeScript.
- **No `print()` for runtime output** — use the `logging` module.
- **Test alongside code, not after.**
- **Commit at natural checkpoints**: per-feature, per-bug-fix, per-doc-update. Small, focused commits over large monolithic ones.
- **Touch targets ≥ 44px** in any UI work.
- **Mobile first.** If you change UI, resize the preview to 375×812 (iPhone SE) and verify before declaring done.
- **No API keys in code, ever.** Read from environment variables; halt with a clear error if missing.
- **System fonts by default.** No Google Fonts link without explicit justification (see [DESIGN.md § 2](DESIGN.md)).

---

## Escalate to a human when…

- The editorial frame would change (e.g. adding a new theme / category, changing the rubric for a subjective field, adding a new entity to the in-scope set).
- A subjective call is contested and you're unsure (stance tags, content categorization, what counts as a primary source).
- A canonical source URL starts 404'ing or paywalls. Pause before switching to a less-canonical source.
- Schema fields would change in a way that cross-cuts seed + frontend + tests + connectors. Sketch the migration plan in a `docs/` file first.
- The user says "ship it" but a test is still failing for unrelated-looking reasons. Surface the failure, don't silently skip.
- A "scar tissue" pitfall in [DESIGN.md § 12](DESIGN.md) seems wrong for the current task. The pitfalls exist because someone hit them; verify the rationale doesn't apply before relaxing the rule.

---

## Cross-project hygiene

Working in this folder means the user may run many small projects in parallel.

- **Stay within the current project's scope.** Don't open files from a sibling project unless the user explicitly asks. The folder-level `backlog.md` is portfolio work, not a substitute for the project's own `backlog.md`.
- **Each project's `security.md` is independent.** Refreshing one doesn't refresh the others.
- **Each project's tests are independent.** Don't infer test status across projects.

---

## When something unexpected happens

Add a concise note to the project's CLAUDE.md or `issues.md`. The pattern is:

1. **What I expected:** one sentence.
2. **What happened:** one sentence.
3. **Why:** one sentence (root cause, not symptom).
4. **What to do next time:** one sentence (the actionable lesson).

The note grows the project's scar tissue. The next agent (or you, a month from now) avoids the same hour-long detour.

That growth — files getting *slightly* more specific with each session's surprises — is the asset. Don't rewrite from scratch; append.

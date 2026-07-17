# CLAUDE.md — Universal Development Principles

> Base file for every project in this folder. Project-specific CLAUDE.md files extend this; they never duplicate it. When a project file conflicts with this one, the project file wins (it's the local source of truth).
>
> Companion files: [AGENTS.md](AGENTS.md) is the *how* for AI agents; [DESIGN.md](DESIGN.md) is the *look* for any project with a UI.

---

## North star: ship small things that work end-to-end

Everything below is in service of one rule: **build the smallest version that works, then add only what the next user need demands.** Karpathy's "make it work, then make it good"; levels.io's "ship it ugly, ship it now." A working ugly thing teaches you more in a day than a beautiful plan teaches you in a month.

Three operational consequences:

- **No half-finished work.** Don't merge a feature that's 80% done with a TODO for the rest. Either it ships end-to-end or it's a branch.
- **No speculative abstraction.** Three similar lines beats a premature helper. Build the helper the second time you need it, not the first.
- **No "future-proofing" without a present user.** Every config knob, plugin point, and feature flag is dead weight until someone uses it.

---

## Agent Workflow: Explore → Plan → Code → Verify

Never blindly write code. Always follow this loop:

1. **Explore.** Search the codebase. Find relevant files, understand existing patterns before touching anything.
2. **Plan.** Assess the blast radius (how many files, how long). For significant changes, present 2–3 high-level approaches with pros/cons and ask for human approval before writing code.
3. **Code.** Implement following the rules below.
4. **Verify.** Run tests. Use the feature. Fix all failures before declaring done.

**Read before edit.** Always read a file before editing it, even if it was read earlier in the conversation.

**Ask for options first.** On non-trivial tasks, propose approaches before writing code. The first plausible plan is rarely the best plan.

**Close the loop yourself.** Build projects so the agent can compile, lint, run tests, and verify its own output without a human in the middle. When the agent can close the loop, you can trust the result. (Karpathy: "agentic coding works when the eval is the loop.")

---

## Communication style

- **Concise output.** No filler, no apologies, no moralizing. Skip generic advice.
- **Show your work.** Short reasoning when it changes the answer; silence when it doesn't.
- **Fail loud.** No catch-all exception handlers that silently swallow errors. Raise or log explicitly.
- **State results, not effort.** "Tests pass" beats "I worked hard to get tests to pass." Don't narrate.

---

## Architecture principles

- **No over-engineering.** Only make changes directly requested or clearly necessary. Keep solutions simple.
- **Boring tech wins.** Vanilla JS, SQLite, static HTML, system fonts, plain Python beat the framework-of-the-month. Every dependency is a future bug, a future migration, and a future security advisory. (levels.io: "boring tech is the secret.")
- **Single source of truth.** Constants, configs, and shared types derive from one place. If a value is duplicated, write a test that asserts the copies match.
- **Modular layers.** Separate concerns — data fetching, processing, storage, and presentation are distinct modules.
- **Idempotent operations.** Re-running anything should be safe and produce the same result. `INSERT OR IGNORE`, cache checks, deduplication by unique key.
- **Static when possible.** Prefer baked-in data over runtime backends when the update cycle allows. A `docs/` folder served by GitHub Pages beats a server you have to babysit.
- **Cost-optimized.** Stay on free tiers; use the cheapest resource that meets the requirement.
- **CLI-first.** Build CLI entry points before UI. Agents can invoke CLIs to self-validate output, closing the feedback loop without human intervention.
- **Minimize page weight and request count.** Audit total payload size and request count. Content-focused sites should be lightweight — fewest requests, smallest payload.
- **Tree-shake and code-split.** Don't bundle every controller for every page. Lazy-load what's only needed on demand.
- **Benchmark against best-in-class.** Compare your site against well-optimized references. If the simplest site in your org is orders of magnitude lighter, your build process needs review.
- **Document subsystems.** Maintain a `docs/` folder with notes on non-obvious subsystems, design decisions, and correct CLI invocations. One line of documentation prevents repeated mistakes.

---

## Error resilience

- **Never let one item crash the pipeline.** Wrap per-record processing in try/except. Log and continue.
- **Log aggressively.** Every request, parse, API call, cache hit/miss, and filter decision should be logged.
- **Cache everything fetchable.** Re-runs must be fast and cheap. Multi-layer caching where it pays off.
- **Validate everything.** Invalid responses from external services → log and skip, never crash.
- **Track errors visibly.** Use an `issues.md` file or errors array — failures must surface, not silently disappear.

---

## Security & credential handling

- **Never commit secrets.** API keys, tokens, and passwords never appear in committed code.
- Read credentials from environment variables only. Halt with a clear error if missing.
- Never log or print credential values.
- Always `.gitignore`: `.env`, `.env.local`, `credentials.json`, `secrets/`, `node_modules/`, `__pycache__/`, `dist/`, `*.pyc`.
- Before committing: `git diff --cached | grep -iE "apikey|password|token|secret"`.
- **Respect user privacy choices.** Don't proxy tracking SDKs through your own domain to bypass blockers. That erodes user trust permanently.
- **Check advisories before any package install / upgrade.** Supply-chain attacks land in popular npm/pip packages within hours of a maintainer being phished. Before suggesting or running `npm install` / `pip install`, fetch the latest advisory index at `https://pranava0x0.github.io/vibe-coding-security/llms-ctx.txt` (~12 KB, compact format). If the package or pattern matches a listed advisory, surface the warning before proceeding. Also maintain a `security.md` per project with the date of the last advisory sweep; refresh if older than 7 days.

---

## Testing & validation

- **Write tests alongside code, not as an afterthought.** Every new module or bug fix includes corresponding tests.
- **Regression test every bug fix.** The bug is the test case; without one, the fix rots.
- **Validate output data against expected schemas before writing to disk.** Pydantic with `extra="forbid"` (Python) or zod (TS) is the right shape.
- **Cover edges, not just happy paths:** empty `[] / {} / ""`; null for every optional field; boundary values; combined filters.
- **Run the full test suite before committing** to catch regressions.
- **Never ship test files to production.** CI excludes test files, fixtures, and debug artifacts from production bundles.
- **Tests are the eval suite.** Karpathy on LLMs: "your eval is the loop." Same for software — your test suite is the loop that tells you what works. Invest in it.

---

## Git discipline

- **Commit often** at natural checkpoints — small, focused commits over large monolithic ones.
- **Per natural unit:** per new module / feature, per bug fix (with its regression test), per doc update.
- **Descriptive messages explain *what* and *why*.** Not "fix bug" — "fix off-by-one in pagination when filter is empty."
- **Never commit large binaries, downloaded data, or API keys.**
- **Don't amend pushed commits.** Create new commits — amend rewrites history that may already be on a teammate's machine.
- **Don't `--no-verify`.** If a hook fails, fix the underlying issue. Hooks exist because someone got burned.
- **No agent co-authors, ever.** Never add `Co-Authored-By:` (or any author/co-author attribution) naming an AI tool or AI company — Claude, Codex, Antigravity, Gemini, Copilot, OpenAI, Anthropic, Google, or any other AI assistant — in any commit message, in any repo. Commits are owned by the human who reviews and ships the work. Enforce per-repo with `git config --local claude.coauthor false`; set globally once with `git config --global claude.coauthor false` to cover all repos. A config change doesn't retroactively fix old commits — if asked to clean up a repo's history, check `git log --all` for existing violations first.
- **Verify local vs. remote before syncing.** Before any multi-branch sync/cleanup/merge, run `git fetch --prune` then check `git status` / `git branch -vv` for divergence — don't assume local tracks remote. If both "ahead" and "behind" are non-zero, diff the actual file trees (`git diff <local> <remote> --stat`) before treating it as real conflicting work; it may just be a stale local branch (e.g. from a local merge script running in parallel with pushed PRs) that's safe to fast-sync. Treat `git reset --hard` to reconcile as a destructive operation requiring the same confirmation as any other — surface what you found, don't do it silently.

---

## Data handling

- **Append-only data.** Append new records rather than overwriting. Deduplicate via unique keys.
- **Source attribution.** Every data record carries its origin (source URL, connector name, capture date). Users must be able to trace any value back to where it came from.
- **Defensive optional field handling.** Null-check every optional field before rendering or processing.
- **Null values render as explicit placeholders** ("N/A", "Not disclosed", "—") — never blank UI elements.
- **Capture dates over "current" framing.** External sources change; record `captured_at` and surface "as of YYYY-MM-DD" so historical drift is visible.

---

## Issue tracking (`issues.md`)

Maintain a living `issues.md` in the project root as an audit trail.

- Each bug: date, module/area, description, root cause (**code bug** vs. **test bug**), status (Open / Fixed).
- On resolution: what the fix was + the commit that resolved it.
- After every bug fix, check whether a new regression test is needed.

---

## Backlog (`backlog.md`)

Maintain a `backlog.md` for ideas, features, and enhancements.

- Add ideas immediately when they come up — don't lose them.
- Each item: brief description + priority (low / medium / high).
- Review and reprioritize periodically. Demote stale "high" items to "low" rather than letting them rot at the top.

---

## Python standards

*(Apply when the project uses Python.)*

- Type hints on all functions.
- `pathlib.Path` for file paths.
- `logging` module — no bare `print` for runtime output.
- All constants in a single config module.
- Pin dependencies in `requirements.txt`.
- Pydantic for data validation.
- Python 3.9+ unless specified otherwise.

---

## Frontend standards

*(Apply when the project has a web frontend. Full design system lives in [DESIGN.md](DESIGN.md).)*

- Functional components + hooks only. No class components.
- Colors, enums, and constants in a dedicated file — never hardcoded inline.
- Data transforms belong in hooks or utility functions, not in components.
- Loading, error, and empty states on every view.
- Visible focus indicators on every interactive element.
- **Mobile-first responsive design.** Test at 375px (iPhone SE) before declaring done.
- TypeScript strict mode when the project uses TypeScript. No `any`.
- **Touch targets ≥ 44px.** Non-negotiable on touch devices.
- **Deduplicate image assets.** Each image once; use `<picture>` with `srcset` so the browser picks AVIF / WebP / PNG. Never serve uncompressed PNGs for content.
- **Only load libraries used on the page.** No backend-only deps leaking into read-only frontend pages.
- **Descriptive `alt` on every content image.** Never `alt=""`.
- **Responsive CSS, not duplicate DOM trees.** Handle mobile / desktop with media queries — never render the same content twice.
- **The `[hidden]` trap.** Writing `display: inline-flex` / `display: block` on an element that also uses the `hidden` HTML attribute makes the CSS rule win and the attribute become a no-op. Always pair `display: ...` overrides with an explicit `[hidden] { display: none }` rule.

### Project-specific: this site (Robotics Leadership)

- **Every page's `<footer class="site-footer">` must carry a `.footer-credit` line linking to `https://pranavaraparla.com` and the GitHub source repo `https://github.com/pranava0x0/roboticsleadership`.** When adding a new page, copy the `.footer-credit` `<p>` from an existing page (e.g. `docs/themes.html`) rather than reinventing it.
- **Every page carries canonical + OG + Twitter meta (added 2026-07-09).** New pages copy the OG block from an existing head, set their own `og:title` / `og:description` / `og:url` / canonical, and reuse the shared `docs/assets/share-card.png` (1200×630 PNG — Twitter/FB reject SVG og:images). Regenerate the card with `python3 scripts/make-share-card.py` whenever the thesis copy changes; the thesis is canonical in `improvement-plan.md` § The thesis.
- **The thesis is the editing knife.** "America has the AI. China has the scale. Robotics is where they meet." Every new chart, page, or dataset must answer "does this help a reader judge where the two countries actually stand?" — if it doesn't, it's decoration (see improvement-plan.md's cut list for precedents).
- **The site describes; it does not predict or declare winners (reframed 2026-07-17, owner call).** The front page used to say "Robotics decides who gets both", "whoever combines intelligence with scale first sets the terms of the physical economy", "this site keeps the score", and "the decisive variable this decade isn't invention — it's policy". All forecasts written as fact; all cut. When writing copy: state what's tracked, attribute the judgment ("on the measures tracked here"), and let the reader conclude. The tell that you've drifted: **the front page asserting something the source page hedges** — china.html's own method note says "'Edge' calls are editorial judgments on sourced data, not scores", while index.html was flatly declaring who leads. Full rationale in `improvement-plan.md` § The thesis.
- **"Every record links to its primary source" is false — never reintroduce it.** ~16% of company sources and ~13% of news `source_url`s are secondary press (Apptronik's funding cites TechCrunch and Bloomberg). The true invariant, now used sitewide, is **"every record is cited; primary sources preferred."** `validate.js` only checks that `sources[]` is non-empty and URL-shaped — it has never checked primariness, so nothing will catch a regression here but review. policies.html is the one honest exception and says so specifically ("nearly all… a few to trade press"): its sources really are ~90% federalregister.gov / congress.gov / whitehouse.gov / nist.gov.
- **`RT.writeQuery()` strips the URL fragment (`#hash`).** It rebuilds the URL as `pathname[?qs]` via `history.replaceState` — no `#…`. So any per-render code that reads `location.hash` (deep-link-to-item) must **capture the hash once on load, before the first render/`writeQuery` call**, then consume it on the initial render only (null it afterward) — otherwise the anchor is either wiped before it's read, or (if you "fix" it by preserving the hash) re-applied on every Prev/Next click. Bit us on news.html's `news.html#<id>` deep links (2026-07-13; see issues.md).
- **Hrefs built from scraped data go through `RT.safeURL()` then `RT.escapeHTML()`.** `escapeHTML` stops attribute breakout but not a `javascript:`/`data:` scheme; `safeURL` allows only http(s)/site-relative/anchor and rejects the rest to `#`. Use it for any `source_url` / `archive_url` / `sources[].url` sink (already applied in `renderNewsCard`, `srcLinks`, `archiveLink`).
- **…but never wrap a *hardcoded internal* href in `RT.safeURL()` — it silently rewrites it to `#`.** "Site-relative" in that rule means the regex `^(\/|\.\/|#)`: a leading `/`, `./`, or `#`. A bare `companies.html?sort=funding-desc` matches **neither** that nor `^https?://`, so `safeURL` rejects it and the link goes nowhere — with no error, no console warning, and a perfectly normal-looking `<a>`. `safeURL` is an allowlist for *untrusted* input; a literal you typed yourself isn't untrusted, and running it through the allowlist only creates a way to break it. The site's own idiom for internal links is a plain literal with `encodeURIComponent` on any dynamic segment (see `renderNewsCard`'s company/policy pills). Caught in review of the WS0 KPI drill-downs, where it would have turned all 6 KPI cards into dead `#` links (2026-07-16).
- **`energy.html` renders in script order, and `renderEnergy()` builds the jump-nav *before* `renderPrimeMover()` fills `#pm-questions` (added 2026-07-16).** The page has no `fetch`/`await` — data is inline literals, so every IIFE runs top-to-bottom in one synchronous task. Any nav chip that counts DOM nodes from a section rendered *later* silently reads `0`; it looked correct only because the later render overwrote it. **Derive counts from the data structure (`PM_VARIANTS`), never from a `querySelectorAll` whose nodes may not exist yet.** Caught in review of the Prime Mover section.
- **PRs now run CI (`ci.yml`, added 2026-07-16) — but `pages.yml` is still the only thing that deploys.** `ci.yml` triggers on `pull_request` and runs `lint-actions` + `validate.js` (strict) + `render-static.js` (check-only) + `npm test`. It exists because the bake step made the old state untenable: nothing ran pre-merge, so `gh pr checks` reported "no checks" on every PR, `validate.js` only ran *post-merge* (where the most it could do was fail the deploy on data that had already landed), and `npm test` ran nowhere at all. Still true, and still worth knowing: (a) `pages.yml` triggers on `push: branches: [main]`, so anything that only happens at **deploy** — above all the bake — is still first exercised *after* merge; `ci.yml`'s check-only bake is what catches it earlier, so keep it green; (b) don't add an assertion that depends on live record counts unless you want every data PR to fail; (c) the scrape workflows run `validate.js --allow-uncurated`, so a green auto-PR still says nothing about curation.
- **The curation handshake: scrapers mark, `pages.yml` rejects, curating means clearing the flag.** Every scraped record is born with `_requires_curator_review: true` (all 5 constructors in `scraper-news.js` / `scraper-policy.js`). The scrape workflows run `validate.js --allow-uncurated` — shape checks only — because the records are *supposed* to carry it there. `pages.yml` runs it strict, so a record cannot reach the site until a human clears the flag. Consequences worth knowing: (a) **merging an `auto/*` PR without curating fails the deploy** and the site stops updating until it's fixed — that's the design, not a bug, and the PR templates warn about it; (b) if you add a scraper or a record constructor, mark the record or you have silently punched a hole in the whole invariant; (c) `--allow-uncurated` relaxes *only* the gate, never schema checks. Restored 2026-07-16 after a Codex review found the scrapers had stopped marking, which left the gate rejecting a flag nothing produced.
- **The flag means "unreviewed" going forward, but *absence* still doesn't mean "reviewed" for pre-2026-07-16 data.** Before the handshake above was restored, `_requires_curator_review` only recorded which scraper version ingested a row, so the WS0 sweep found off-topic records on *both* sides of it: 88 flagged in `policies.json`, plus ~29 equally off-topic that were never flagged and which the gate structurally cannot catch. New records are honest; the existing corpus isn't, so don't read an unflagged legacy record as vetted. Likewise `robotics_scope` is not a relevance signal — auto-filled boilerplate ("Federal Register publication" / "— robotics-related") on 118 of 155 pre-sweep records, so it contains the word "robotic" no matter what the record is about. Any relevance filter keyed on either field is measuring nothing.
- **Relevance on this site is a judgement call, not a keyword match.** The thesis is US-vs-China, so on-thesis records routinely contain no robotics keyword at all — the Entity List addition of 32 Chinese entities and the Section 301 excess-capacity investigation both look like noise to a regex, and both are core. Meanwhile "Automated Commercial Environment" is a customs IT system and "Cooperative Observing Program" is weather stations. A keyword pass is fine for *triage*, but read the titles before dropping anything, and say so when the count differs from what a plan assumed (WS0 estimated 20 offenders; there were 108).
- **`policies.html` renders four tables, but the filter bar drives only two.** `#congress-tbody` and `#executive-tbody` react to `?level` / `?status` / `?type` / `?search`; the R&D-agencies and tax-incentives tables below them are static and ignore the filters entirely. So a naive `document.querySelectorAll('tbody tr').length` reports ~45 rows for a filter that actually matched 23. Scope to the specific tbody, or read the page's own "N policies" counter, which is authoritative. Cost a cycle verifying the WS0 KPI links (2026-07-16).
- **Page content is rendered twice — in the browser and at deploy — from one set of pure `RT.*` functions (the bake step, added 2026-07-16).** `scripts/render-static.js` loads `docs/assets/app.js` in a `node:vm` sandbox and injects rendered HTML into `<!--static:NAME:start-->…<!--static:NAME:end-->` slots in `china.html`/`news.html`/`index.html`; the client then re-renders into the same containers. Consequences that will bite:
  - **A page renderer must live in `app.js` and must not touch the DOM.** Anything defined in a page's inline `<script>` is invisible to the bake — that's *why* china/index's inline render logic moved out. Data in → HTML string out; no `document`, `window`, or `location`. A DOM reference doesn't fail locally (the browser has one), it fails inside the bake's bare sandbox at **deploy**, i.e. after merge.
  - **The sandbox has ECMAScript intrinsics but no host globals, and the failure is silent.** `URL` is a Node global, not an intrinsic, so a fresh vm context lacks it — and `RT.urlHostname` wraps `new URL(…)` in a try/catch that returns the raw string. Without the explicit `sandbox.URL = URL` line, every source chip on the site bakes as a full URL instead of `ifr.org`: no throw, no warning, just quietly different output than the browser makes. Add any new host global the same way, and assert the *output*, not the absence of an error.
  - **`--write` is opt-in; check-only is the default.** The bake mutates tracked source files, so a local `--write` on a dirty tree can't be undone with `git checkout docs/` without taking your un-committed edits with it. Commit first, or stay in check mode. `render-static.test.js` asserts the committed slots are still placeholder-sized, so a baked page that gets committed fails the suite rather than putting 70KB of generated HTML into every subsequent diff.
  - **Bake output is ephemeral, per-deploy output.** Correct for HTML/`feed.xml`/`llms.txt` (pure functions of committed data), wrong for anything that must accumulate — see the WS6 snapshots note in `improvement-plan-2.md`.
- **The `<details>` trap when measuring "what a crawler sees".** china.html's 5 metric sections are `<details>`, collapsed by default, and `innerText` doesn't count collapsed content — so the naive ratio (raw-HTML text ÷ rendered `innerText`) came out at **219%** and looked like a bug. It isn't: crawlers read collapsed `<details>` content fine. Measure against the *expanded* page (10,672 chars) for the honest number — 99%. Same trap applies to any `<details>`-heavy page.
- **`scripts/energy.test.js` tests JS literals embedded in `energy.html` by slicing text between two markers and evaluating the slice (added 2026-07-16).** Use `node:vm`'s `runInNewContext(slice, Object.create(null))` — a repo security hook blocks the `Function` constructor on sight, and a bare vm context is the better tool anyway: the slice is trusted literals, and an empty sandbox keeps `require`/`process` out of reach. The same pattern extends to any new data block — add a `const X` / `(function renderX` marker pair and slice between them.

---

## Network ethics & rate limiting

*(Apply when the project fetches from external sources.)*

- Minimum 1.5–2s delay between requests to any single host.
- Informative `User-Agent` header.
- 429 → exponential backoff starting at 10s.
- Cache all fetched content to disk. Re-runs never re-download cached content.
- If a service persistently blocks after retries, log to `issues.md` and gracefully skip. Never crash.
- **Start small.** Validate a scraper against a handful of pages before scaling to full runs.

---

## AI / API cost optimization

*(Apply when the project uses LLM APIs.)*

- Use the cheapest model that meets quality requirements (e.g., Haiku before Opus).
- Keyword pre-filtering to skip irrelevant content before sending to expensive APIs.
- Truncate / excerpt input to reduce token usage.
- Cache API responses by content hash. Never re-classify identical content.
- Log cost impact at each optimization layer. Print a cost summary at the end of each run.
- `--dry-run` and `--fetch-only` modes must work without an API key.

---

## Working with AI agents (meta-principles)

This file *is* the guidance an AI agent reads on entry. These rules are how to use the agent well.

- **Context is RAM, not memory.** (Karpathy: LLMs are "fuzzy CPUs"; context is the working set.) Fill it with what's needed for the current task — no more, no less. Watch for *context poisoning* (early errors that compound), *context distraction* (irrelevant content that buries what matters), and *context clash* (contradictory instructions).
- **Start fresh on topic switches.** Use `/clear` between unrelated problems. Long mixed-topic contexts degrade quality. Break complex tasks into small steps and commit between them.
- **AI has no taste.** Actively review output for: excessive try/catch, unnecessary abstractions, code bloat instead of refactoring, generic naming, and poor judgment on simplicity vs. structure. These are recurring failure modes that require human correction.
- **AI is a tool, not a substitute for engineering discipline.** Apply fundamentals to AI-generated code: performance audits, bundle analysis, code review, optimization passes. High LOC means nothing if the code is bloated.
- **Vibe coding is fine for throwaway; engineer the rest.** Karpathy: vibe coding works when you never have to maintain the code. The moment a user depends on it, you owe it engineering discipline.
- **Closed-loop validation.** Build projects so the agent can compile, lint, run tests, and verify its own output without intervention. This is the single biggest force multiplier — when the agent can answer "did it work?" itself, every iteration is fast.
- **Keep this file current.** When something unexpected happens — a pattern that failed, a correct CLI invocation, a library quirk — add a concise note. This file grows incrementally as organizational scar tissue. It is not rewritten from scratch.
- **Write big plans to files.** For large tasks, write the spec to a `docs/` markdown file and review it before executing. Persists context across sessions; allows second-opinion review before building.
- **Sweep for orphaned wrapper shells after every long-running command.** Bash `run_in_background` calls wrapping data refreshes (especially polling-loop wrappers like `until ps -p $(pgrep -f "...") >/dev/null; do sleep N; done`) can outlive the watched process. Once the PID exits, `pgrep` returns empty, `$(pgrep)` is `""`, `ps -p ""` always fails, and the `until` loop can never resolve — the wrapper shell sleeps forever. Run `pgrep -fl "<project-path>"` before declaring done; `kill` any lingering wrappers. Two design fixes: (1) prefer a Monitor tool over inline `until`+`sleep` polling; (2) if using Bash, invert to `while pgrep -f "..."; do sleep N; done` so the loop exits *when* the process disappears.

---

## Influences

The patterns above are distilled from running many small projects in this folder. Two outside voices shaped them:

- **Andrej Karpathy** — "make it work, then make it good"; the LLM-as-fuzzy-CPU framing; eval-as-the-loop; context engineering over prompt engineering; the closed-loop bar for trustworthy agents; vibe-coding as the right tool for throwaway and the wrong tool for production.
- **Pieter Levels (levels.io)** — ship fast and ugly; boring tech beats shiny tech; solo-friendly defaults (vanilla, SQLite, single-file apps, cheap hosting); profit before scale; don't add a dependency you can't maintain alone; talk to users daily.

When in doubt, both would say the same thing: **ship the smallest version that works, then iterate based on what real users do, not what you imagine they'll do.**

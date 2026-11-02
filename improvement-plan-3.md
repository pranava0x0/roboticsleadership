# Improvement Plan v3 — site reorganisation around R&D, build, and policy (2026-10-26)

> Successor to [improvement-plan-2.md](improvement-plan-2.md) for one question only: **how the site's tabs should be organised now that it has twelve of them.** Everything else in plan v2 (news product, depth ladder, history, analytics) stays open there. The thesis in [improvement-plan.md](improvement-plan.md) § The thesis is still the editing knife: a tab earns its place only if it helps a reader judge where the two countries actually stand.
>
> Inputs: the owner's brief of 2026-10-26 ("broad top tabs: R&D, supply chain and deployment, policies, and some miscellaneous thing; policy can switch between domestic and foreign; lots of stuff overlaps"), the R&D research sweep of the same date (`data/research/rd-2026-10-26/`), the nav as shipped on `main`, and the interaction-cost gate (`uat/interaction-tasks.json`).

Effort: **S** (<1h) · **M** (half-day) · **L** (multi-session).

---

## Where we are

Primary nav on every page, in order: Front page · News · US vs China · Companies · Policy · Draft EO · Supply Chain · Energy · States · Themes · SCSP Summit, and this PR adds **R&D** after US vs China. Twelve links. The priority+ nav keeps them all reachable, but at 375px eight of them live under "Sections", and the order says nothing about how the pages relate.

The overlaps the owner noticed are real:

| Overlap | Where it shows |
|---|---|
| Components | `supply-chain.html` ranks twelve categories by US/China/RoW share; the new R&D **Component stack** tab describes the same parts from the robot's side (what each does, who makes it, open designs). Same category ids, two angles. |
| China's policy | China's industrial policy and export controls are split across `china.html` (scoreboard rows), `policies.json` records tagged Geopolitics, and news. There is no page a reader would call "foreign policy". |
| Deployment | Deployments live inside `companies.json` (`deployments[]`), energy deployments live in `energy.html`'s inline literals, and the supply-chain page has a "final assembly" category. No deployment view exists. |
| Events | `scsp-summit.html` is a dated event brief that holds a permanent top-nav slot. |
| Narrative | `themes.html` (8 narratives) and the front page's briefs both summarise the same corpus. |
| The EO | `physical-ai-action-plan.html` is a policy instrument filed next to Policy as a sibling, with a label ("Draft EO") that reads as if the site drafts policy. Renamed in this PR to **Proposed policy investment areas**; still a top-level link until Phase 1 below. |

---

## Options considered

**Option A — keep the flat priority+ nav, reorder it.** Twelve links ordered by reader intent (catch up → score → how it is built → who → what government does → reports). Zero structural work; crawlers see one `<a>` per page as today.
*Against:* twelve is past the point where order helps; the mobile dropdown still hides two-thirds of the site; the overlaps above stay unresolved because nothing on the page says which tabs are siblings.

**Option B — hub tabs with a sibling bar (recommended).** Six or seven primary tabs, each a *group*. Pages keep their own URLs and files (deep links, bake slots, interaction tasks and the sitemap all survive). Under the primary nav, every page in a group renders a one-line **section bar** listing its siblings, with `aria-current` on itself. The primary nav shrinks because the group's first page is the only one in it. Where a group's content is one dataset (R&D), the siblings are in-page sub-tabs instead (the `RT.initSubTabs` component this PR adds, `?tab=` deep-linkable, JS-off safe).
*Against:* two navigation rows on every page (the section bar is not sticky, so the swipe budget is unaffected, but it is one more line above the fold); a group's first page carries two roles.

**Option C — merge each group into one page with in-page tabs.** One Policy page with Federal / States / Investment areas / China & trade panels, one Build page with Supply chain / Companies / Deployments.
*Against:* page weight (policies.json 276 KB + state_policy + the EO's prose on one page), the bake step would have to carry every panel, `#` deep links break, and the interaction-cost gate would re-baseline the whole site. Rejected except where the data is already one file (R&D, which is why rd.html is built this way).

**Option D — audience-first nav (Staffer / Investor / Researcher).** Every page belongs to every audience; it duplicates links rather than grouping them. Rejected.

---

## Recommendation — Option B, in four phases

### Target structure

| Primary tab | Siblings (section bar or sub-tabs) | Today's files |
|---|---|---|
| **Front page** | — | `index.html` |
| **News** | — | `news.html` |
| **US vs China** | Scoreboard · Themes | `china.html`, `themes.html` |
| **R&D** | Foundation models · World models · Benchmarks · R&D areas · Component stack (in-page sub-tabs) | `rd.html` + `data/rd.json` |
| **Build & deploy** | Supply chain · Companies · Deployments · Energy (special report) | `supply-chain.html`, `companies.html`, new deployments view, `energy.html` |
| **Policy** | Federal · States · Proposed investment areas · China & trade · Events | `policies.html`, `states.html`, `physical-ai-action-plan.html`, new china-policy view, `scsp-summit.html` |
| **About** | Method · Data · Cite us | new, long missing (plan v2 WS3) |

"Domestic vs foreign" lands as **Federal / States** (domestic) versus **China & trade** (foreign) inside Policy. The China & trade view does not need a new dataset to start: it is a filtered render of `policies.json` records with a new `jurisdiction` field plus the export-control rows already in `us_china.json`.

### Phase 0 — this PR (shipped with the R&D build)
- [x] R&D page with five in-page sub-tabs and `data/rd.json`; `RT.initSubTabs` is the reusable in-page sibling component.
- [x] Draft EO renamed to Proposed policy investment areas (title, meta, nav, llms.txt); the body keeps its executive-order form; policies.html links to it as a section.
- [x] Component stack cards link to `supply-chain.html#<category>` so the two component angles point at each other instead of competing.
- [x] Nav grows to twelve. Accepted as temporary; Phase 1 removes five.

### Phase 1 — section bar and a seven-link nav (S/M)
- [ ] `docs/data/nav.json`: one source of truth for groups and order (today the nav block is duplicated in twelve HTML files and checked only by eye). The bake step injects it; `layout-guards.test.js` asserts every page's nav matches it.
- [ ] `RT.renderSectionBar(groupId, currentPage)`: a plain `<nav aria-label="In this section">` under the masthead, links only, no JS needed. Rendered in HTML by the bake so crawlers see it.
- [ ] Primary nav becomes: Front page · News · US vs China · R&D · Build & deploy · Policy · About (About can wait for Phase 4; ship six).
- [ ] Interaction-cost: re-run `--establish-budgets`; expect Energy, States, Themes and SCSP Summit targets to go up by one tap (primary → sibling) and the five R&D targets to stay. Read the budget diff before committing it. Anything over +1 tap is a layout bug, not a budget change.
- [ ] Energy keeps "Special report" framing; SCSP Summit moves under Policy › Events and loses its top slot.

### Phase 2 — Policy: domestic / foreign (M)
- [ ] Add `jurisdiction: us | china | multilateral` to `policies.json` (validate.js enum; scrapers default to `us` for Federal Register and Congress). Back-fill the ~15 export-control and Entity-List records by hand; they are the ones a keyword pass misses (CLAUDE.md: relevance is a judgement call).
- [ ] `policies.html?view=china` (or a thin `china-policy.html`) renders the `china` + `multilateral` records with the MOFCOM / Entity List / Section 301 timeline that today only exists as prose on china.html. Keep the 15-row cap and Show more pattern.
- [ ] Policy section bar: Federal · States · Proposed investment areas · China & trade · Events.

### Phase 3 — Build & deploy: a deployments view (M)
- [ ] `RT.renderDeployments(companies)` from `companies[].deployments[]`: by sector, by country, by status (`planned` / `pilot` / `production`), with the energy page's deployment literals migrated into `companies.json` or a small `deployments.json` so energy stops being the one page whose data is not JSON.
- [ ] Supply chain keeps country shares; the R&D component stack keeps the robot-side view; both read `supply_chain.json` category ids so a rename happens once.

### Phase 4 — About (S)
- [ ] One page: how records are cited (and the honest primariness numbers from CLAUDE.md), how to cite the site, the datasets list that llms.txt already carries, the refresh cadence, and who runs it. Linked from every footer.

---

## What the R&D sweep says the R&D tab should keep doing

Three signals from the 2026-10-26 research, each verified against a primary page, that should steer what the tab tracks next (details and quotes in `data/research/rd-2026-10-26/`):

1. **Egocentric human video is becoming the pre-training substrate.** Figure's Index app (16M+ videos, a stated $1B+ twelve-month spend) lifted Helix 2.5's zero-shot success in 30 unseen homes from 9% to 56% against its own from-scratch baseline; Dyna-2 and Natura-1 report ~1M hours of human video each. The tab should track hours-of-human-video as a column the way the scoreboard tracks installs.
2. **World-action models are the generalisation bet.** NVIDIA's DreamZero, Dyna-2 and Ant Group's LingBot-VA 2.0 all define the category; the World models sub-tab needs a `role` split (simulator vs policy pre-training) because the same word covers both.
3. **Benchmarks are the contested ground, not the models.** Only 19.8% (LIBERO) and 19.7% (SimplerEnv) of state-of-the-art claims are provably significant; RoboArena's top two entries overlap within their uncertainty; RoboDojo's leader changed between the paper's frozen table and the live board. Every leaderboard figure on the tab carries an as-of date and a "vendor-reported / third-party" flag, and the refresh playbook should re-pull the live JSON feeds (RoboArena, RoboDojo, Robocurve) each run rather than trusting last month's number.

---

## Non-goals
- No audience-based nav. No merging of data pages into one file. No sticky section bar (it would raise swipe costs site-wide). No new top-level tab for events, academia or workforce until the Phase 1 structure exists to hold them as siblings.

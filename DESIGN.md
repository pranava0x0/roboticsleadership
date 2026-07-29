# DESIGN.md — Universal Visual & UX Principles

> Base file for every project in this folder with a UI. Project-specific `design.md` files extend this with palette, motif, and content rules. When project conflicts with base, project wins.
>
> Companion files: [CLAUDE.md](CLAUDE.md) is the engineering principles; [AGENTS.md](AGENTS.md) is the agent workflow.

---

## 1. Posture

Two sentences set every call below:

1. **The content is the product. Chrome earns its pixels.** Headers, filters, KPIs — anything that isn't the primary surface (map, feed, list, form, canvas) justifies itself by helping the user understand or narrow what they're looking at.
2. **Performance is a design constraint, not a follow-up.** Every "nice touch" (web font, blur, full-page animation) competes with the first paint and the 60fps pan/zoom budget. Choose perf when they conflict.

Aesthetic should follow the product. An editorial dashboard reads like the FT (serif headlines, citation footer, tabular numerals). A consumer app reads like its category (warm palette for food, dark + accent for tooling). A government data tool reads like a public record. Don't paste one product's voice onto another. Project-level `design.md` carries the *specific* visual identity; this file carries the *universal* rules every identity has to respect.

---

## 2. Typography — system stacks only by default

No web fonts unless the project specifically justifies one. A Google Fonts link costs a render-blocking RTT and ~50KB; the system stack approximates Charter / Inter / SF Mono on every target browser.

```css
--font-sans:  -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui,
              "Helvetica Neue", Arial, sans-serif;
--font-serif: "Charter", "Source Serif 4", "Source Serif Pro",
              "Iowan Old Style", "Apple Garamond", "Palatino", "Georgia",
              "Times New Roman", serif;
--font-mono:  ui-monospace, "SF Mono", "JetBrains Mono", Menlo,
              Consolas, monospace;
```

- **Serif for editorial display** (H1, hero H2, KPI numerals, verbatim quotes). Signals "this is content, not chrome."
- **Sans for body and UI** (everything else).
- **Mono for code, IDs, paths, share codes.** Anything that has to round-trip a copy/paste.
- **Tabular numerals.** `font-feature-settings: "tnum"` on `:root`. Any column of numbers (KPIs, table cells, dates, counts) lines up.

If the project genuinely needs a custom font (rare — most don't), audit the alternative system stack on target browsers before introducing a fetch.

---

## 3. Color tokens

**All colors live as CSS custom properties on `:root`, with `[data-theme="dark"]` overrides.** JS reads via `getComputedStyle()` — never hardcode a hex outside `:root`.

```css
:root {
  --bg: …;          /* page background */
  --surface: …;     /* cards, panels */
  --surface-2: …;   /* inputs, secondary surfaces */
  --border: …;
  --text: …;
  --text-muted: …;
  --accent: …;      /* primary CTA, focus ring */
}

[data-theme="dark"] {
  --bg: …;
  /* ... */
}
```

### 3.1 Semantic separation

When a project uses color to encode meaning (status, stance, category), keep *meaning* and *brand* in separate token families:

- **Brand / surface tokens** — neutral chrome (`--bg`, `--surface`, `--text`).
- **Semantic tokens** — meaning (`--status-{success,warning,error}`, `--stance-{positive,mixed,negative}`).
- **Category tokens** — distinguish without ranking (`--category-{a,b,c}`).

Never conflate them. Coloring "category" with the same palette as "status" tells the user "category A is bad," which is rarely what you mean.

### 3.2 Brand-adjacent colors are not brand colors

When showing third-party brands (companies, products, services), use **brand-adjacent but neutral** tones — desaturated versions that distinguish without implying endorsement. Using a company's actual brand color implies affiliation and invites legal questions.

### 3.3 Theme swap is JS, not filter

When users toggle light/dark, re-paint via the CSS variable swap and a JS pass over any canvas / SVG layers that read the variables. Never use `filter: brightness/contrast` on a tile pane or content layer — it recomposites every pan/zoom frame and tanks mobile perf.

---

## 4. Spacing scale

A 4 / 8 px ladder covers ~99% of cases:

`4, 6, 8, 10, 12, 14, 16, 18, 22, 24, 28, 32`

If you find yourself typing `7px` or `13px`, round to the nearest step unless you have a documented reason. A project usually doesn't need an explicit `--space-2` variable — keep values inlined until a refactor would actually save more LOC than it churns.

---

## 5. Radii, shadows, motion

- **Radii:** `4` (chips), `6` (small inputs), `8` (buttons, cards), `12` (modals), `14` (mobile bottom sheets), `999` (pills).
- **Shadows:** one soft (`0 1px 2px rgba(0,0,0,0.06)`) for at-rest cards; one elevated (`0 4px 18px rgba(0,0,0,0.08)`) for panels and toasts. Dark theme uses heavier alpha (`0.4–0.5`) because contrast against a dark `--bg` needs more.
- **Motion:**
  - `90ms` — table row hover, color swaps
  - `120ms` — button / input hover
  - `200ms` — panel slide-in/out, modal open
  - `300ms max` — toast, fade
  - **No motion above 300ms.** No CSS animations on hot paths (pan / zoom / scroll).
- **Respect `prefers-reduced-motion`.** When set, kill panel transforms and any non-essential transition.

---

## 6. Layout — mobile-first, three breakpoints

Default to three viewport bands, matched 1:1 with Tailwind defaults:

| Width band     | Name    | Tailwind prefix | Layout shape                                     |
| -------------- | ------- | --------------- | ------------------------------------------------ |
| `< 640px`      | Mobile  | (none)          | Single column, sticky toolbar, FAB, bottom sheets |
| `640–1023px`   | Tablet  | `sm:`, `md:`    | 2-up grids, full CTA labels, hamburger nav        |
| `≥ 1024px`     | Desktop | `lg:`           | 3-up / 4-up grids, inline nav, side panels        |

A fourth tier is rarely justified — desktop scales fine above 1280 if you cap content width (`max-width: 1280px; margin: 0 auto`).

**Don't use container queries unless an independent embedded component needs them.** Viewport media queries are simpler, work everywhere, and match how the rest of the layout reasons.

**Don't duplicate DOM trees for mobile / desktop.** A `<section class="hero-copy">` that's `display: none` on mobile is fine; rendering a separate mobile-only block is not.

---

## 7. Mobile patterns

- **Bottom sheets, not full-page overlays**, for detail panels and filters. A full overlay covers the primary surface and breaks the "tap a result → read → keep browsing" loop.
- **Carousels (scroll-snap), not stacked grids**, for KPI strips. Stacking pushes the primary surface below the fold.
- **Hide hero copy on mobile**, keep KPI / summary chips. The user already knows what they opened.
- **Bump input font-size to 16px on iOS** to suppress auto-zoom on focus.
- **Respect safe-area-inset.** Bottom-edge FABs, sheets, and bars use `bottom: max(1rem, env(safe-area-inset-bottom))` so they don't sit under the home indicator.
- **Sticky toolbars** so users can switch views from any scroll position; keep them slim (~52px).
- **Touch targets ≥ 44 × 44px.** Non-negotiable. Even for "small" admin actions.
- **The `<details>` primitive is preferred over JS accordions.** Native, keyboard-accessible, screen-reader-friendly; `open` toggle doesn't re-render the inner content.

---

## 8. Components

### 8.1 Buttons

| Variant   | Use                                  | Spec                                                 |
| --------- | ------------------------------------ | ---------------------------------------------------- |
| Primary   | The one CTA per view                 | Filled `--accent`, white text, rounded 8/12          |
| Secondary | Adjacent actions                     | Bordered, transparent bg, accent text                |
| Ghost     | Tertiary / inline                    | No border, no bg, accent text, hover bg `--surface-2` |
| Icon      | Toolbar (filters, theme, share)      | 32×32 (44×44 touch target), rounded 8, hover bg     |

Focus state is a 2px `--accent` outline with 2px offset via `:focus-visible` (not `:focus`) so mouse users don't see it on click.

### 8.2 Pills

A single base `.pill { padding: 1px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 600 }` with semantic variants. Outline pills (`.pill.outline`) for "candidate" / "eligible" / "ready" signals; solid pills for status. Stack left-to-right as a readability ladder (program → status → readiness).

### 8.3 Cards

`background: var(--surface); border: 1px solid var(--border); border-radius: 12; padding: 16` is the safe default. Use shadow `0 1px 3px rgba(0,0,0,0.05)` at rest, `0 4px 12px rgba(accent, 0.15)` on hover.

### 8.4 KV grids (detail panels)

```html
<dl class="kv">
  <dt>Label</dt>
  <dd>Value <span class="dd-note">optional sub-line</span></dd>
</dl>
```

`grid-template-columns: 130px 1fr` on desktop, `110px 1fr` on mobile. Null values render as italic muted (`<dd class="muted-cell">Not available</dd>`), never blank.

### 8.5 Toasts

One at a time. Don't grow into a queue — if you need stacked toasts, swap in a real library. Lazy-mount a single `#toast` div, fade in via `.visible`, auto-fade after 4s.

---

## 9. Accessibility (baseline)

| Concern                | Implementation                                                                |
| ---------------------- | ----------------------------------------------------------------------------- |
| Skip to content        | `<a class="skip-link">` is the first focusable element; visually hidden until focused |
| Landmarks              | `<header role="banner">` · `<nav>` · `<main role="main">` · `<aside>` · `<footer role="contentinfo">` |
| Focus indicators       | `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }` on every interactive element |
| Live region for counts | `<span aria-live="polite">` so result counts and dynamic state changes announce |
| Filters as fieldsets   | `<fieldset><legend>` for grouped controls                                     |
| Tabs                   | `role="tablist"` / `role="tab"` / `role="tabpanel"` / `aria-controls` / `aria-selected` |
| Color contrast         | All text/bg pairs ≥ 4.5:1 in both light and dark themes (verify with audit tools) |
| Reduced motion         | `@media (prefers-reduced-motion: reduce)` kills non-essential transforms      |
| Touch                  | `touch-action: manipulation` on interactive elements                          |

---

## 10. Performance constraints on design

Design decisions that look like aesthetic calls but are actually performance calls:

| Choice                                      | Reason                                                      |
| ------------------------------------------- | ----------------------------------------------------------- |
| System fonts only (default)                 | Save a render-blocking RTT + ~50KB                          |
| No `backdrop-filter: blur` on map / overlay | Recomposites on every pan/zoom frame                        |
| No `filter:` on hot panes                   | Same                                                        |
| CSS-var theme + JS re-paint                 | Theme swap doesn't trigger a full re-style cascade          |
| Canvas markers, not SVG                     | SVG nodes melt mobile at 10k+                               |
| Pagination + IntersectionObserver           | DOM stays small; sentinel auto-appends only when needed     |
| Lazy-load non-default data layers           | First paint stays small                                     |
| `<link rel="preload">` for critical JSON    | Races the JSON behind defer-loaded JS                       |
| `priority: "low"` on enrichment fetches     | Browser deprioritizes behind first-paint resources          |
| `contain: layout paint` on heavy panels     | Bounds invalidation cost when content re-renders            |

If a proposal trades any of these for visual polish, it either (a) proves it works on a mid-range Android over throttled connection, or (b) gets explicit sign-off that the perf cost is acceptable.

---

## 11. Editorial / content rules

These apply to any project that surfaces data, claims, or content from external sources.

- **Cite primary sources.** Every numeric claim links to a primary or authoritative source. If a claim has no source, it doesn't ship.
- **Surface "why".** Boolean badges ("Eligible", "Candidate", "Verified") carry their qualifying criteria inline as italic sub-lines or tooltips — the badge alone is opaque.
- **Title-case CAPS source data on the way in.** Many federal / government / scraped feeds ship ALL CAPS or placeholder sentinels (`-- Not Defined --`, `_NULL_`). Run a `prettyPlace()` / `prettyName()` at ingest; preserve raw on `*_raw` for debugging. Maintain an acronym whitelist for words that should stay uppercase (NASA, NPS, USA, …).
- **"Not available", not blank.** Optional fields render as italic muted placeholders — never an empty cell.
- **"Adjacent", not "0.0 mi".** Pre-rounding bin edges are signals, not nulls. Render `n < threshold` as a meaningful word, not a misleading number.
- **No emojis by default.** Outline pills do the badge work. If the project's voice calls for emoji (consumer apps, social features), use sparingly and document in the project `design.md`.
- **Lowercase for prose, uppercase for labels.** Eyebrows, KPI labels, table heads, and outline-pill text are uppercase with `0.04–0.14em` letter-spacing. Everything else is sentence case.
- **AI-generated content is visibly distinguished.** A 3px accent left-border on the card plus a meta line crediting the model. The reader should never wonder whether they're looking at primary data or generated narrative.

---

## 12. Common pitfalls (the "scar tissue" list)

These are encoded across this folder's projects. If you're tempted to undo them, read the rationale.

### 12.1 The `[hidden]` trap

`display: inline-flex | block | flex` on an element that uses the `hidden` HTML attribute silently overrides the implicit `display: none`. The element renders despite `hidden` being set.

**Always** ship a `[hidden] { display: none }` rule alongside any `display: ...` override. If the element animates out (e.g. slide), use `visibility: hidden` + `transform` on `[hidden]` instead.

### 12.2 `text-overflow: ellipsis` no-ops on `display: inline`

A `<span>` defaults to `display: inline`; `overflow: hidden` + `text-overflow: ellipsis` silently does nothing. Always set `display: block | inline-block | flex | grid` on the element you're ellipsizing. Pair with `min-width: 0` on the parent grid item.

### 12.3 IntersectionObserver callbacks need a scroll-position guard

`isIntersecting === true` is necessary but not sufficient for "user scrolled near the bottom." During tab swaps and in headless contexts, layout can settle in multiple paint passes, firing the observer several times — each firing prefetches another page. Add an explicit `scrollHeight - scrollTop - clientHeight > 400` check to bail when the user hasn't actually scrolled.

### 12.4 Anything that enumerates a fixed list MUST iterate the source-of-truth array

Reset buttons, dropdown populators, persona buttons — anything that touches "all programs / themes / tiers / categories" must iterate from the canonical constant array, never a hardcoded subset. When the list grows, the iterating code picks up the change for free; the hardcoded subset silently drops the new entries.

### 12.5 No web fonts without sign-off (see § 2)

### 12.6 No CSS `filter` on hot paths (see § 10)

### 12.7 Pills do NOT fall back across columns

When a row has a "Program" column and a "Status" column, the Status cell must render Status-specific content (or `—`), never the Program pill as a fallback. Two identical pills doubles visual noise without adding signal.

### 12.8 Scroll-length levers, and what actually moves the needle (2026-07-21)

Whitespace trimming barely helps — the long pages are content, not padding (a global rhythm pass cut `index` 8.0→7.8 mobile screens). The two levers that work:

- **Collapse by default via the authored `open` attribute, not a runtime flag.** Put `open` only on the `<details>` meant to start expanded; everything else starts collapsed for JS *and* no-JS/crawler/baked readers alike. On `policies.html` the filter bar drives the Congressional + Executive tables, so those keep `open` and only the two static reference tables (agencies, tax) drop it. A JS "force the first section open" rule was tried and reverted — it force-opened a page's authored-*closed* below-the-fold section, adding scroll (Codex, PR #126). Let the collapsible layer restore/persist only; never let it open or close a section the markup didn't ask for.
- **Multi-column card grids from ≥720px** (`.feed` is 2-up): the single biggest win, but it only applies to **card** content. Tables and prose don't reflow to columns — don't force them.
- The deep pages (`energy` 31, `supply-chain` 26 mobile screens) barely move from collapse — their authored default already collapses the secondary sections, and their bulk is non-collapsible prose/tables/charts. Real reduction there is a content restructure, not a CSS pass. Don't over-squeeze density to compensate; it just cramps the design.

---

## 13. What's intentionally NOT in design

Decisions made by *omission*:

- **No icon libraries by default.** System emoji + outline pills cover most needs. Add Lucide / Heroicons only when a project genuinely needs ~30+ distinct glyphs.
- **No animation libraries.** CSS transitions and Tailwind's `animate-pulse` cover what we need without the bundle weight.
- **No marker clustering on maps** (when canvas markers + decimation handle the load). `leaflet.markercluster` is the right answer when interactive behavior demands grouping.
- **No multi-toast queue** (until a project actually needs it).
- **No infinite zoom / unconstrained pan.** Set `maxBounds`. Most projects have a meaningful viewport (US-only, city-only); enforce it.
- **No backend until profit / scale demands one.** Static-first is the default. JSON in `docs/`, GitHub Pages, no runtime. (levels.io: "you don't need a backend.")

---

## 14. When to revisit this document

- A new component pattern emerges across 2+ projects (promote from project `design.md` to here).
- A bullet in § 12 (pitfalls) repeats in a third project — that means it needs more emphasis or a different remedy.
- A new accessibility standard lands (WCAG update, platform-level mandate).
- A perf budget regresses across the portfolio (e.g. mid-range Android performance audit).

---

## 15. Theme system — the four Asimov themes

> **Project-specific.** Most rules in this document are universal. The four themes below are the concrete visual identity of the Robotics Tracker project. They override § 2's "no web fonts" default with an explicit justification: **the typography is the theme identity**. Without distinct type, the themes collapse into "just a palette swap."

The project ships four named themes, each evoking a setting from Isaac Asimov's Robot series. The aesthetic philosophy of each theme is enforced by typography, color, density, and motion — not by extra components or layouts.

### 15.1 Architecture

- **Single source of truth: CSS custom properties** on the `<html>` element, scoped by `[data-theme="<name>"]`. JS reads `getComputedStyle()` for any value it needs; no hex codes live outside the theme blocks.
- **Token names are role-based, not theme-specific.** `--bg`, `--surface`, `--surface-2`, `--text`, `--text-muted`, `--accent` mean the same role in every theme; only the value changes. The variable `--font-serif` is the "display / headers" font even when the theme's chosen face is technically condensed-sans (Caves) or monospace (Robot Dreams).
- **`<html data-theme="...">` is set before first paint** by a tiny inline boot script reading `localStorage` and falling back to `prefers-color-scheme`. Avoids FOUC.
- **Persistence:** `localStorage.theme` stores one of `caves` / `naked-sun` / `dawn` / `robot-dreams`. Legacy values `light` and `dark` migrate to `naked-sun` and `caves` respectively.
- **Default rule:** `prefers-color-scheme: dark` → `caves`, otherwise `dawn`. Any stored choice wins over both.
- **Per-theme aesthetic tokens** allow a single component (`.card`, `.pill`, `.surface`) to look different across themes without theme-specific CSS classes. Tokens that vary per theme: `--radius-card`, `--shadow-rest`, `--shadow-elevated`, `--surface-backdrop` (the last only set in Robot Dreams).

### 15.2 Accessibility — WCAG 2.1 AA

All four themes meet or exceed **4.5:1 for every text token** — including `--text-faint`, which carries real
text (dates, record counts, KPI sublabels) and is therefore held to the body-text bar, not the 3:1 large-text
one — and **3:1 for `--border-strong`**, the keyline the front page's section rules and rail dividers are drawn
with. Verified, not asserted: the 2026-07-28 rework was checked pair-by-pair with a scripted WCAG calculator
over every (token, background) combination below before it landed, including the composited value of Robot
Dreams' translucent surfaces over its `--bg`. The worst ratio in each theme:

| Theme           | Body on bg | Muted on bg | Faint on bg | Accent on bg | Weakest checked pair |
|-----------------|------------|-------------|-------------|--------------|----------------------|
| Caves of Steel  | 17.1:1     | 8.9:1       | 5.3:1       | 10.4:1       | `--border-strong` 3.9:1 |
| The Naked Sun   | 17.4:1     | 7.5:1       | 5.5:1       | 8.3:1        | `--border-strong` 3.1:1 |
| Robots of Dawn  | 14.8:1     | 6.7:1       | 5.4:1       | 6.5:1        | `--border-strong` 3.3:1 |
| Robot Dreams    | 14.4:1     | 6.8:1       | 4.5:1       | 9.0:1        | `--text-faint` 4.5:1 |

Two theme-specific rules survive the rework:

- **Caves' `--status-positive` is only ever used on dark surfaces** (it is a dark-mode-only theme, so this is
  automatic, but it is why the token may not be lifted into a light theme unchanged).
- **Robot Dreams requires `--accent-on` for text inside any accent fill.** The accent moved from cyan to amber
  but the hazard did not: amber `#F2A65A` on warm-silver `#E8E4DB` is ~1.9:1. Any filled `.btn.primary`,
  `.pill.cat-accent`, or skip-link must take `color: var(--accent-on)`.

Other accessibility requirements every theme respects:

- **Fallback font stacks** declared after every web font; if the network fails or the font is being fetched, the system fallback is visually close.
- **`@media (prefers-reduced-motion: reduce)`** kills theme-specific transitions (Naked Sun's slow fades, Robot Dreams' glow pulses).
- **Focus indicators** never go below 2px solid outline at 2px offset; cyan inside Robot Dreams uses `outline-color: var(--accent)` so it's visible against any surface.
- **No information conveyed by color alone.** Status pills always pair color with a label.

### 15.3 Theme specs

> **Reworked 2026-07-28.** The first pass named the themes after the books; this one takes its values *from*
> them. Four things changed and each is a book detail, not a taste call — they are recorded here because the
> next person to "tidy" a hex code needs to know what it was doing.

#### Theme 1 — Caves of Steel (Earth)

**Aesthetic.** The enclosed City: eight million people under one roof, no sky, permanent artificial light.
Sharp borders replace open whitespace; numbers and tables dominate. Flattest edges of the four.

**What the book changed.** The accent is now **low-pressure sodium amber**, the actual colour of the lighting
a domed City and its expressway strips would run on — `#FFC700` was a lemon yellow no sodium lamp emits.
`--status-positive` is **yeast-vat green**, because Earth eats what the New Jersey yeast farms grow; the old
`#00FF66` was a terminal-phosphor green with nothing to do with the setting. Neutrals carry a faint blue-steel
cast: steel and concrete, not warm carbon.

```
Display font  Barlow Condensed, "Arial Narrow", "Helvetica Condensed", sans-serif
Body font     Roboto, system-ui, "Segoe UI", Arial, sans-serif

--bg              #101013  steel black (was #121212 warm carbon)
--surface         #191a1e
--surface-2       #232529  concrete
--border          #303338
--border-strong   #6b7280                              3.9:1 — keylines must be visible
--text            #f2f3f5                             17.1:1
--text-muted      #adb2ba                              8.9:1
--text-faint      #828892                              5.3:1
--accent          #ffb000  low-pressure sodium amber   10.4:1
--status-positive #86c46a  yeast-vat green              9.2:1
--radius-card     2px      sharpest of the four (was 4px)
--shadow-rest     0 0 0 1px rgba(0,0,0,0.5)            flat, no blur
```

#### Theme 2 — The Naked Sun (Solaria)

**Aesthetic.** Twenty thousand people on a whole planet, ten thousand robots each. Hyper-minimalist, sterile,
ultra-isolated; the only decoration is whitespace, and the transitions are the slowest of the four (Solarians
do not hurry, and they meet by "viewing", never in person).

**What the book changed.** The word for this world is *bleached*, so **every neutral is now cold**. The old
palette's alabaster beige (`--surface-2 #F0ECE1`, `--border #E5E0D5`) was the single biggest reason this theme
read as a slightly duller Robots of Dawn rather than its opposite — two light themes that both leaned warm.
The accent is Solarian estate cypress pushed toward teal: the one saturated thing on an over-lit world.

```
Display font  Didot, "Bodoni MT", "Bodoni Moda", "Big Caslon", Georgia, serif
Body font     Inter, system-ui, -apple-system, "Segoe UI", sans-serif

--bg              #fbfcfc  bleached white
--surface         #ffffff
--surface-2       #eceff1  cold grey (was #F0ECE1 warm beige)
--border          #dfe4e7  (was #E5E0D5)
--border-strong   #8a9298                              3.1:1
--text            #15181a                             17.4:1
--text-muted      #4f585d                              7.5:1
--text-faint      #5f686e                              5.5:1 — was 4.15:1, failed AA
--accent          #14564a  cold cypress                 8.3:1
--radius-card     14px
--shadow-rest     none     intentionally flat
--transition-slow 320ms
```

#### Theme 3 — The Robots of Dawn (Aurora)

**Aesthetic.** Aurora is named for the goddess of the dawn — the World of the Dawn, first and richest of the
Spacer worlds. Utopian, premium, serene. Rounded cards, soft depth, reads like an Atlantic feature.

**What the book changed.** The direction was already right; the depth was not. `#8C4303` reads brown rather
than sunrise and left no contrast headroom, so the accent is now a deeper terracotta struck by low sun. The
category ramp gains the violet of the sky before sunrise (funding) and a true rose (competitive). This is the
one theme allowed to be unapologetically warm — it is what The Naked Sun is now defined against.

```
Display font  Cormorant Garamond, Georgia, "Iowan Old Style", "Apple Garamond", serif
Body font     Montserrat, system-ui, -apple-system, "Segoe UI", sans-serif

--bg              #fff8f2  dawn blush
--surface         #ffffff
--surface-2       #f3e4d6  warm marble
--border          #e8d9c7
--border-strong   #9e8668                              3.3:1
--text            #2b221c                             14.8:1
--text-muted      #655648                              6.7:1
--text-faint      #756454                              5.4:1 — was 3.81:1, failed AA
--accent          #9a3d12  low-sun terracotta           6.5:1
--cat-funding     #5a3a8c  pre-dawn violet
--cat-competitive #a32a64  dawn rose
--radius-card     16px     most pronounced
```

#### Theme 4 — Robot Dreams (the subconscious)

**Aesthetic.** Elvex, the robot who dreams. Soft-edged, lit from within, glassmorphic surfaces over a
grey-indigo ground.

**What the book changed — the big one.** This theme was cyan-on-midnight with Orbitron, which owed more to
stock sci-fi than to the 1986 story: *cosmic* was never in it. What Elvex actually dreams is a colourless grey
in which robots labour, lit by one distant sun. So the ground is **grey-indigo, not saturated space blue**;
the text is **warm silver**; the hairlines are **warm grey, not blue**; and the accent is **a single amber
light**, the sun of the dream. Orbitron gave way to **Fraunces**, a soft-serif whose optical wonkiness reads
dreamlike where a wide-tracked geometric read like a spaceship console. The glass and the glow stay — the
dream is still soft-edged — only the hue moved. The theme's picker tag changed from "Cosmic" to
"Subconscious" to match.

```
Display font  Fraunces, "Iowan Old Style", Georgia, "Palatino Linotype", serif  (was Orbitron)
Body font     Plus Jakarta Sans, system-ui, -apple-system, sans-serif

--bg               #14151a  grey-indigo (was #0A0915 positronic midnight)
--surface          rgba(31, 33, 41, 0.66)   glass
--surface-2        rgba(31, 33, 41, 0.45)
--surface-backdrop blur(12px) saturate(120%)
--border           rgba(205, 199, 187, 0.16)  warm grey (was blue)
--border-strong    rgba(205, 199, 187, 0.45)           3.1:1
--text             #e8e4db  warm silver                14.4:1
--text-muted       #a39d91                              6.8:1
--text-faint       #847e73                              4.5:1
--accent           #f2a65a  dream-sun amber (was #00E5FF cyan)   9.0:1
--accent-on        #14151a  text colour inside any accent fill
--radius-card      12px
--shadow-elevated  0 0 24px rgba(242, 166, 90, 0.16)   subtle glow
```

> **Robot Dreams pitfall.** The `backdrop-filter: blur(...)` rule violates the § 10 "no filter on hot panes"
> pitfall *for content panes* (maps, scrolling feeds). It is acceptable here because it is applied only to
> bounded card surfaces, not to a viewport-sized scrolling layer. If we later add a map view, the cards must
> drop blur when overlaid on map tiles or perf collapses on mobile.

### 15.4 Toggle UI

A single disclosure element in the header. Native `<details>` for show/hide (zero JS for the open/close primitive), a `<fieldset>` with four `<input type="radio">` for selection. Keyboard accessible by HTML default; semantic; no ARIA roles needed beyond the labeled fieldset.

Why not a `<select>`: native select chrome can't be styled across browsers without invasive overrides, and it doesn't accommodate per-option preview/description chips.
Why not a popover menu with `role="menu"`: more JS for the same UX as a `<details>` + radios.

The disclosure is sticky-in-header on every page so a user reading on one page can switch themes without losing position.

### 15.5 When to add a fifth theme

The four cover four distinct moods. Don't add a fifth unless an editorial use case demands it (e.g. a print-friendly mode, or a colorblind-safe mode that the four can't all satisfy via tokens alone). Each new theme is a maintenance tax — every component template has to be visually validated against every theme.

---

## Influences

- **FT, Bloomberg Businessweek, ProPublica, Greater Greater Washington** — editorial gravitas through typography and restraint, not dependencies.
- **Linear** — typography discipline, dark UI without losing readability.
- **Apple Human Interface Guidelines** — touch targets, safe areas, mobile-first ergonomics.
- **Pieter Levels (levels.io)** — "you don't need a backend, you don't need a CSS framework, you don't need a font, you don't need npm." When in doubt, ship the simpler thing.
- **Andrej Karpathy** — performance budgets are real constraints, not afterthoughts; measure before optimizing; the smallest version that works is the right starting point.

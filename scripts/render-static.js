#!/usr/bin/env node
/**
 * render-static.js — the deploy-time "bake" step.
 *
 * The problem it solves: every page on this site is client-rendered, so the
 * deployed HTML carries almost no content. LLM crawlers don't execute JS, and
 * no-JS crawlers saw ~10-35% of each page — the scoreboard and all ~741 news
 * records were invisible to them. That is goal 4 of improvement-plan-2.md.
 *
 * "Bake, not build": this is NOT a bundler and the repo stays no-build for
 * local dev. It loads the committed JSON, calls the same pure RT.* renderers
 * the browser calls, and injects the resulting HTML into marked slots in the
 * shipped pages. pages.yml runs it between validate and upload, against an
 * ephemeral checkout. The client still hydrates into the same containers, so
 * a JS visitor sees exactly what they see today.
 *
 * Slots are literal comment pairs in the HTML:
 *     <!--static:name:start--> …placeholder… <!--static:name:end-->
 * The markers survive the bake, so re-running is idempotent, and a slot with
 * no renderer (or a renderer with no slot) is a hard error rather than a
 * silently empty section.
 *
 * Writing is opt-in. Without --write this only renders and reports: the bake
 * mutates tracked source files, and a local run that quietly left hundreds of
 * KB of generated HTML in the working tree would be committed sooner or later.
 * CI passes --write into a throwaway checkout.
 *
 *   node scripts/render-static.js            # check only (default; CI on PRs)
 *   node scripts/render-static.js --write    # mutate docs/ in place (pages.yml)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = resolve(ROOT, 'docs');

const DATASETS = ['companies', 'policies', 'news', 'themes', 'us_china', 'supply_chain'];

/**
 * Load docs/assets/app.js and hand back its RT export.
 *
 * app.js is an IIFE over `window`. At module scope it touches only
 * `document.readyState` — to decide whether to boot now or on DOMContentLoaded
 * — and `global.RT = {…}`. Reporting 'loading' parks init() on a listener this
 * process never fires, so nothing DOM-dependent runs here; we get the pure
 * renderers and none of the page lifecycle.
 *
 * runInNewContext (not the Function constructor) both because a repo hook
 * blocks Function on sight and because a bare context is the better tool: the
 * sandbox starts empty, so a renderer that reaches for `document` or `fetch`
 * throws here at deploy instead of silently degrading.
 *
 * URL must be passed in explicitly. It is a Node host global, not an ECMAScript
 * intrinsic, so a fresh V8 context does not have it — and RT.urlHostname wraps
 * `new URL(…)` in a try/catch that falls back to the raw string. Without this
 * line every source chip would silently bake as a full URL instead of a
 * hostname: no error, just quietly different output than the browser produces.
 */
export function loadRT() {
  const src = readFileSync(resolve(DOCS, 'assets/app.js'), 'utf8');
  const sandbox = Object.create(null);
  sandbox.window = {};
  sandbox.document = { readyState: 'loading', addEventListener() {} };
  sandbox.console = console;
  sandbox.URL = URL;
  runInNewContext(src, sandbox, { filename: 'docs/assets/app.js' });
  const RT = sandbox.window.RT;
  if (!RT) throw new Error('docs/assets/app.js did not export window.RT');
  return RT;
}

export function loadData() {
  const data = {};
  for (const name of DATASETS) {
    data[name] = JSON.parse(readFileSync(resolve(DOCS, `data/${name}.json`), 'utf8'));
  }
  return data;
}

// ---------- Slot renderers, one map per page ----------
// Values are HTML strings. Where the client uses textContent, escape here — the
// slot lands in markup either way, and the two must agree.

function chinaSlots(RT, data) {
  const uc = data.us_china;
  return {
    'china-bluf': RT.renderChinaBluf(uc),
    'china-scoreline': RT.renderChinaScoreline(uc),
    'china-scorebar': RT.renderChinaScoreBar(uc),
    'china-sections': RT.renderChinaSections(uc),
    'china-unitree-title': RT.escapeHTML(uc.unitree_case.title),
    'china-unitree-intro': RT.escapeHTML(uc.unitree_case.intro),
    'china-unitree-rows': RT.renderUnitreeRows(uc),
    'china-method': RT.escapeHTML(RT.chinaMethodNote(uc)),
  };
}

// Bakes page 1 of the default view (newest first, no filters) — deliberately
// RT.NEWS_PAGE_SIZE cards, not the "~50" the plan sketched. The feed is
// paginated, so 50 baked cards would be replaced by 20 the moment JS runs and
// the "Page 1 of N" control below them would contradict what shipped. Matching
// the client's first paint keeps the deployed HTML honest, and 20 full cards
// already clears the ≥70% no-JS content bar.
function newsSlots(RT, data) {
  const { news, companies, policies } = data;
  const rows = RT.latestNews(news, RT.NEWS_PAGE_SIZE);
  return {
    'news-feed': rows.map((n) => RT.renderNewsCard(n, companies, policies)).join(''),
    'news-result-count': RT.escapeHTML(RT.newsResultCount(news.length, 1, RT.NEWS_PAGE_SIZE)),
  };
}

function indexSlots(RT, data) {
  const { companies, policies, news, themes, supply_chain: sc } = data;
  const kpis = RT.computeKPIs(companies, policies, sc);
  return {
    'index-kpis': RT.renderKPIStrip(kpis),
    'index-recent-news': RT.latestNews(news, 5)
      .map((n) => RT.renderNewsCard(n, companies, policies, { linkToFeed: true })).join(''),
    'index-themes': RT.renderThemeCards(themes),
    'index-companies': RT.renderTopCompanies(companies),
  };
}

export const PAGES = {
  'china.html': chinaSlots,
  'news.html': newsSlots,
  'index.html': indexSlots,
};

// ---------- Slot machinery ----------
const MARKER_RE = /<!--static:([a-z0-9-]+):start-->/g;

export function fillSlot(html, name, content) {
  const start = `<!--static:${name}:start-->`;
  const end = `<!--static:${name}:end-->`;
  const si = html.indexOf(start);
  const ei = html.indexOf(end);
  if (si < 0) throw new Error(`slot "${name}": no ${start}`);
  if (ei < 0) throw new Error(`slot "${name}": no ${end}`);
  if (ei < si) throw new Error(`slot "${name}": end marker precedes start marker`);
  return html.slice(0, si + start.length) + content + html.slice(ei);
}

/**
 * Fill every slot in `html`. Markers and renderers must correspond exactly:
 * a marker with no renderer would ship an empty section, and a renderer with
 * no marker would silently render nothing. Both are bugs worth a failed
 * deploy, since pages.yml is the only place this runs on main.
 */
export function bake(html, slots) {
  const inPage = new Set([...html.matchAll(MARKER_RE)].map((m) => m[1]));
  const given = new Set(Object.keys(slots));
  const orphans = [...inPage].filter((n) => !given.has(n));
  const missing = [...given].filter((n) => !inPage.has(n));
  if (orphans.length) throw new Error(`slot marker(s) with no renderer: ${orphans.join(', ')}`);
  if (missing.length) throw new Error(`renderer(s) with no slot marker: ${missing.join(', ')}`);

  let out = html;
  for (const [name, content] of Object.entries(slots)) out = fillSlot(out, name, content);
  return out;
}

export function bakeAll({ write = false } = {}) {
  const RT = loadRT();
  const data = loadData();
  const results = [];
  for (const [page, slotsFor] of Object.entries(PAGES)) {
    const file = resolve(DOCS, page);
    const slots = slotsFor(RT, data);
    const out = bake(readFileSync(file, 'utf8'), slots);
    const bytes = Object.values(slots).reduce((n, s) => n + s.length, 0);
    if (write) writeFileSync(file, out);
    results.push({ page, slots: Object.keys(slots).length, bytes });
  }
  return results;
}

// ---------- CLI ----------
// import.meta.url check keeps the exports importable from the test suite
// without the CLI firing on import.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const write = process.argv.includes('--write');
  try {
    const results = bakeAll({ write });
    for (const r of results) {
      console.log(`${write ? 'baked  ' : 'checked'} ${r.page.padEnd(11)} ${String(r.slots).padStart(2)} slots  ${(r.bytes / 1024).toFixed(1)}KB`);
    }
    const total = results.reduce((n, r) => n + r.bytes, 0);
    console.log(`\n${write ? 'Baked' : 'Checked'} ${results.length} pages, ${(total / 1024).toFixed(1)}KB of static HTML.`);
    if (!write) console.log('(check only — pass --write to update docs/ in place)');
  } catch (err) {
    console.error(`render-static: ${err.message}`);
    process.exit(1);
  }
}

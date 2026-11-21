#!/usr/bin/env node
/**
 * render-static.test.js — regression tests for the deploy-time bake step.
 *
 * Why this suite earns its keep: the bake runs in pages.yml, which triggers on
 * push-to-main only. A bake bug therefore surfaces *after* merge, where the
 * most it can do is fail the deploy and stop the site updating. These tests
 * (plus the pull_request job in ci.yml) are what move that failure earlier.
 *
 * Run: node scripts/render-static.test.js
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRT, loadData, bake, fillSlot, bakeAll, PAGES } from './render-static.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = resolve(ROOT, 'docs');

let failures = 0;
function ok(cond, label) {
  if (cond) console.log(`✓ ${label}`);
  else { failures++; console.error(`✗ ${label}`); }
}
function eq(actual, expected, label) {
  if (actual === expected) console.log(`✓ ${label}`);
  else {
    failures++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}
function throws(fn, match, label) {
  try {
    fn();
    failures++;
    console.error(`✗ ${label} (did not throw)`);
  } catch (err) {
    if (String(err.message).includes(match)) console.log(`✓ ${label}`);
    else { failures++; console.error(`✗ ${label}\n    message missing ${JSON.stringify(match)}: ${err.message}`); }
  }
}

// ---------- The Node shim ----------
const RT = loadRT();
ok(typeof RT === 'object' && RT !== null, 'app.js loads in a bare vm context and exports RT');
for (const fn of ['renderNewsCard', 'renderChinaSections', 'computeKPIs', 'renderKPIStrip', 'latestNews', 'srcLinks']) {
  ok(typeof RT[fn] === 'function', `RT.${fn} is callable from Node`);
}
eq(typeof RT.NEWS_PAGE_SIZE, 'number', 'RT.NEWS_PAGE_SIZE crosses the sandbox boundary');

// URL is a Node host global, not an ECMAScript intrinsic, so a fresh vm context
// lacks it — and urlHostname swallows the ReferenceError and returns the raw
// string. That degrades every source chip on the site from "ifr.org" to a full
// URL with no error at all. Assert the label, not the absence of a throw.
eq(RT.srcLinks(['https://www.ifr.org/a/b']).includes('>ifr.org<'), true,
  'URL is present in the sandbox: source chips bake as hostnames, not raw URLs');

// A chart of actuals must not imply that its latest observations are forecasts.
const trendFixture = [
  { year: 2024, us_units: 34, china_units: 295, row_units: 213 },
  { year: 2025, us_units: 38, china_units: 354, row_units: 208 },
];
const trendElements = { svg: {}, legend: {}, source: {} };
RT.renderProductionTrend(trendFixture, trendElements);
ok(!trendElements.legend.innerHTML.includes('projected'), 'actual-only trend has no projection legend');
ok(!trendElements.svg.innerHTML.includes('stroke-dasharray'), 'actual-only trend has no dashed forecast');
RT.renderProductionTrend([...trendFixture, { year: 2026, us_units: 40, china_units: 370, row_units: 220, projected: true }], trendElements);
ok(trendElements.legend.innerHTML.includes('projected') && trendElements.svg.innerHTML.includes('stroke-dasharray'), 'a real projection retains its dashed line and legend');

// ---------- Escaping survives the trip through Node ----------
const hostile = {
  id: 'x"><script>alert(1)</script>',
  title: '<img src=x onerror=alert(1)>',
  category: 'Funding" onmouseover="evil()',
  source: 'ACME',
  date: '2026-07-01',
  summary: 'plain',
  source_url: 'javascript:alert(1)',
};
const card = RT.renderNewsCard(hostile, [], []);
ok(!card.includes('<script>'), 'renderNewsCard escapes a script tag in an id');
ok(!card.includes('<img src=x'), 'renderNewsCard escapes markup in a title');
ok(!card.includes('onmouseover="evil()"'), 'renderNewsCard neutralises attribute breakout in a category');
ok(!card.includes('javascript:'), 'renderNewsCard rejects a javascript: source_url via safeURL');

// ---------- Slot machinery ----------
const SAMPLE = '<p><!--static:a:start-->placeholder<!--static:a:end--></p>';
eq(fillSlot(SAMPLE, 'a', 'CONTENT'), '<p><!--static:a:start-->CONTENT<!--static:a:end--></p>',
  'fillSlot replaces the region and keeps both markers');
eq(fillSlot(fillSlot(SAMPLE, 'a', 'CONTENT'), 'a', 'CONTENT'), fillSlot(SAMPLE, 'a', 'CONTENT'),
  'fillSlot is idempotent — markers survive so a re-bake replaces, not appends');
eq(fillSlot('<p><!--static:a:start--><!--static:a:end--></p>', 'a', 'X'),
  '<p><!--static:a:start-->X<!--static:a:end--></p>', 'fillSlot handles an empty placeholder');

throws(() => fillSlot('<p>nothing</p>', 'a', 'X'), 'no <!--static:a:start-->', 'fillSlot fails loud on a missing start marker');
throws(() => fillSlot('<p><!--static:a:start--></p>', 'a', 'X'), 'no <!--static:a:end-->', 'fillSlot fails loud on a missing end marker');
throws(() => fillSlot('<p><!--static:a:end--><!--static:a:start--></p>', 'a', 'X'), 'end marker precedes start', 'fillSlot fails loud on inverted markers');

throws(() => bake('<p><!--static:ghost:start--><!--static:ghost:end--></p>', {}), 'no renderer: ghost',
  'bake fails loud on a slot marker nothing renders (would ship an empty section)');
throws(() => bake('<p>no markers</p>', { orphan: 'x' }), 'no slot marker: orphan',
  'bake fails loud on a renderer with nowhere to go (would render nothing, silently)');

// ---------- Real data through the real pages ----------
const data = loadData();
const results = bakeAll({ write: false });
eq(results.length, Object.keys(PAGES).length, 'every configured page bakes without error');
for (const r of results) {
  ok(r.bytes > 2000, `${r.page} bakes substantive content (${(r.bytes / 1024).toFixed(1)}KB)`);
}

// Idempotence on the real pages, not just the sample.
for (const [page, slotsFor] of Object.entries(PAGES)) {
  const html = readFileSync(resolve(DOCS, page), 'utf8');
  const slots = slotsFor(RT, data);
  const once = bake(html, slots);
  eq(bake(once, slots), once, `${page}: baking a baked page is a no-op`);
}

// ---------- The content the bake exists to publish ----------
const china = bake(readFileSync(resolve(DOCS, 'china.html'), 'utf8'), PAGES['china.html'](RT, data));
const tally = RT.chinaTally(data.us_china);
eq(tally.us + tally.china + tally.even, tally.total, 'china tally accounts for every metric');
ok(china.includes(`<strong>${tally.total} metrics</strong>`), 'china.html ships the metric count in HTML');
ok(china.includes(`<strong>${tally.china}</strong> favor China`), 'china.html ships the China tally in HTML');
ok(china.includes(data.us_china.sections[0].metrics[0].metric), 'china.html ships metric rows in HTML');
ok(!china.includes('<!--static:china-sections:start--><!--static:china-sections:end-->'),
  'china.html sections slot is not left empty');

// China's plans (2026-11-11): every plan, every target with its original Chinese,
// and a translation line on each plan, because nearly all the English is ours.
const cp = data.china_plans;
for (const p of cp.plans) {
  ok(china.includes(`id="plan-${p.id}"`), `china.html ships plan ${p.id}`);
  ok(cp.series.some((s) => s.id === p.series), `${p.id} belongs to a declared series`);
}
const planBlock = china.slice(china.indexOf('id="sec-china-plans"'));
eq((planBlock.match(/class="plan-src"/g) || []).length, cp.plans.length, 'each plan carries a source and translation line');
const targetRows = cp.plans.reduce((n, p) => n + p.targets.length, 0);
eq((planBlock.match(/<tr><td>/g) || []).length, targetRows, 'every target row is baked');
for (const p of cp.plans) for (const t of p.targets) {
  if (t.quote_zh) ok(china.includes(RT.escapeHTML(t.quote_zh)), `${p.id}: original wording missing for "${t.text_en.slice(0, 40)}"`);
}
ok(!/<details class="collapsible-section" id="sec-china-plans"[^>]*\bopen\b/.test(china), 'plans section ships collapsed');

const news = bake(readFileSync(resolve(DOCS, 'news.html'), 'utf8'), PAGES['news.html'](RT, data));
const cardCount = (news.match(/class="feed-card"/g) || []).length;
eq(cardCount, RT.NEWS_PAGE_SIZE, 'news.html bakes exactly one client page of cards');
const newest = RT.latestNews(data.news, 1)[0];
ok(news.includes(RT.escapeHTML(newest.title)), 'news.html ships the newest story title in HTML');

const index = bake(readFileSync(resolve(DOCS, 'index.html'), 'utf8'), PAGES['index.html'](RT, data));
const kpis = RT.computeKPIs(data.companies, data.policies);
eq((index.match(/class="kpi-card"/g) || []).length, kpis.length, 'index.html bakes every KPI card');
ok(index.includes(`id="kpi-strip" class="${RT.kpiStripClass(kpis)}"`),
  'index.html bakes the strip class that matches its card count');
// The install gap is the front page's lead figure: the baked number must be the
// latest reported year's China/US ratio, and the dot chart must carry one dot
// per 1,000 installs (each row is a dashed line; count dots from its length).
{
  const hist = data.supply_chain.production_trend.filter((r) => !r.projected && r.us_units && r.china_units);
  const last = hist[hist.length - 1];
  ok(index.includes(`<p class="gap-figure tnum">${Math.round(last.china_units / last.us_units)}×</p>`),
    'index.html bakes the install-gap figure from the latest reported year');
  const dots = (cls) => [...index.matchAll(new RegExp(`<line class="${cls}" x1="([\\d.]+)"[^>]*x2="([\\d.]+)"`, 'g'))]
    .reduce((n, m) => n + Math.round((parseFloat(m[2]) - parseFloat(m[1])) / 14) + 1, 0);
  eq(dots('cn'), Math.round(last.china_units / 1000), 'install-gap waffle draws one China dot per 1,000 installs');
  eq(dots('us'), Math.round(last.us_units / 1000), 'install-gap waffle draws one US dot per 1,000 installs');
}
{
  const metrics = data.us_china.sections.flatMap((s) => s.metrics).filter((m) => ['us', 'china', 'even'].includes(m.edge));
  eq((index.match(/class="edge-mark edge-/g) || []).length, metrics.length, 'edge board bakes one square per measure with an edge call');
  ok(!/edge-board[\s\S]{0,4000}\btotal\b/i.test(index), 'edge board does not total the edge calls');
}
// Front page: one lead, three secondary stories, and a rail of briefs plus its
// "all stories" row. The counts come from RT.frontPageStories so the assertion
// tracks the renderer instead of restating its numbers.
const front = RT.frontPageStories(data.news);
eq((index.match(/class="lead-story"/g) || []).length, 1, 'index.html bakes exactly one lead story');
eq((index.match(/class="story-card"/g) || []).length, front.top.length, 'index.html bakes every secondary story');
eq((index.match(/class="brief"/g) || []).length, front.briefs.length, 'index.html bakes every brief');
ok(index.includes('class="brief brief-all"'), 'index.html bakes the rail\'s all-stories row');
ok(index.includes(RT.escapeHTML(front.lead.title)), 'index.html ships the lead headline in HTML');

// The three positions are one split of one sorted list, so no story may appear
// twice — a duplicate lead/brief is the failure mode a naive "latest N" per
// renderer would produce, and it is invisible until someone reads the page.
const frontIds = [front.lead.id, ...front.top.map((n) => n.id), ...front.briefs.map((n) => n.id)];
eq(new Set(frontIds).size, frontIds.length, 'index.html never places the same story in two positions');

// KPI hrefs are hand-written literals, not scraped input. safeURL would reject
// "companies.html?sort=…" (it matches neither ^https?:// nor ^[/.#]) and rewrite
// every card to a dead "#". Assert the links survive — this exact mistake was
// caught in review of the WS0 KPI drill-downs.
ok(index.includes('href="companies.html?sort=funding-desc"'), 'baked KPI cards keep working internal hrefs');

// ---------- Front-page news payload ----------
// index.html fetches news-recent.json instead of the archive. The front page must be
// identical from the trimmed payload, and the bake must write a matching file.
{
  const RT2 = loadRT();
  const { news } = loadData();
  const recent = RT2.newsRecentPayload(news);
  eq(recent.total, news.length, 'news-recent payload carries the full-archive total');
  eq(recent.records.length, Math.min(RT2.NEWS_RECENT_COUNT, news.length), 'news-recent payload is capped at NEWS_RECENT_COUNT');
  const ids = (f) => [f.lead, ...f.top, ...f.briefs].map((n) => n.id).join(',');
  eq(ids(RT2.frontPageStories(recent.records)), ids(RT2.frontPageStories(news)),
    'front page from the trimmed payload matches the front page from the whole archive');
  const onDisk = JSON.parse(readFileSync(resolve(DOCS, 'data/news-recent.json'), 'utf8'));
  eq(onDisk.total, news.length, 'bake wrote docs/data/news-recent.json for the current news.json');
  const sc = JSON.parse(readFileSync(resolve(DOCS, 'data/supply_chain.json'), 'utf8'));
  const trend = JSON.parse(readFileSync(resolve(DOCS, 'data/install-trend.json'), 'utf8'));
  eq(JSON.stringify(trend.production_trend), JSON.stringify(sc.production_trend), 'bake wrote docs/data/install-trend.json matching supply_chain.production_trend');
  eq(RT2.renderInstallGap(trend.production_trend), RT2.renderInstallGap(sc.production_trend), 'install-gap chart is identical from the trimmed payload');
  // 2026-11-19: KPIs, ranked companies and story pills render the same from front-summary.json.
  const cos = JSON.parse(readFileSync(resolve(DOCS, 'data/companies.json'), 'utf8'));
  const pols = JSON.parse(readFileSync(resolve(DOCS, 'data/policies.json'), 'utf8'));
  const fs2 = JSON.parse(readFileSync(resolve(DOCS, 'data/front-summary.json'), 'utf8'));
  const front = RT2.frontPageStories(news);
  eq(RT2.renderKPICards(fs2.kpis), RT2.renderKPICards(RT2.computeKPIs(cos, pols)), 'KPI cards are identical from front-summary.json');
  eq(RT2.renderTopCompanies(fs2.companies), RT2.renderTopCompanies(cos), 'top companies are identical from front-summary.json');
  eq(RT2.renderKPICards(RT2.frontKPIs(fs2)), RT2.renderKPICards(RT2.computeKPIs(cos, pols)), 'client-side KPIs (year recomputed) match computeKPIs');
  const k = RT2.frontKPIs(fs2, 2099)[0];
  eq(k.label, 'Tracked funding · 2099', 'funding KPI label follows the reader\'s year, not the bake year');
  eq(k.value, RT2.formatUSD(0), 'a year with no rounds shows zero, not the bake year\'s sum');
  eq(RT2.renderLeadStory(front.lead, fs2.companies, fs2.policies), RT2.renderLeadStory(front.lead, cos, pols), 'lead story is identical from front-summary.json');
  eq(RT2.renderTopStories(front.top, fs2.companies), RT2.renderTopStories(front.top, cos), 'top stories are identical from front-summary.json');
}

// ---------- Committed pages must stay un-baked ----------
// The bake mutates tracked source files, so a stray local `--write` that got
// committed would put hundreds of KB of generated HTML into git and every
// subsequent data diff on top of it. Placeholders are a few hundred bytes;
// baked regions are 1-36KB, so a generous ceiling separates them cleanly.
const MAX_PLACEHOLDER = 2000;
for (const page of Object.keys(PAGES)) {
  const html = readFileSync(resolve(DOCS, page), 'utf8');
  for (const m of html.matchAll(/<!--static:([a-z0-9-]+):start-->/g)) {
    const name = m[1];
    const start = html.indexOf(`<!--static:${name}:start-->`) + `<!--static:${name}:start-->`.length;
    const end = html.indexOf(`<!--static:${name}:end-->`);
    const size = end - start;
    ok(size < MAX_PLACEHOLDER,
      `${page}: slot "${name}" is committed un-baked (${size}B placeholder; run git checkout docs/ if this fails)`);
  }
}

// --- policies.html "Open for comment": structured deadlines, soonest first, past ones hidden ---
{
  const pol = [
    { id: 'a', title: 'Later <rule>', comment_deadline: '2027-02-22', full_text_url: 'https://www.federalregister.gov/a' },
    { id: 'b', title: 'Sooner', comment_deadline: '2026-11-22', sources: [{ url: 'https://example.gov/b' }] },
    { id: 'c', title: 'Closed', comment_deadline: '2026-11-20', full_text_url: 'https://x.gov/c' },
    { id: 'd', title: 'No deadline' },
    { id: 'e', title: 'Bad link', comment_deadline: '2026-11-21', full_text_url: 'javascript:alert(1)' },
  ];
  const out = RT.renderOpenComments(pol, '2026-11-21');
  ok(out.indexOf('Bad link') < out.indexOf('Sooner') && out.indexOf('Sooner') < out.indexOf('Later'), 'open comments: soonest deadline first');
  ok(!out.includes('Closed') && !out.includes('No deadline'), 'open comments: past and undated records hidden');
  ok(out.includes('closes today') && out.includes('1 day left') && out.includes('93 days left'), 'open comments: days-left arithmetic');
  ok(out.includes('Later &lt;rule&gt;') && !out.includes('javascript:'), 'open comments: title escaped, unsafe href rejected');
  eq(RT.renderOpenComments(pol.slice(2, 4), '2026-11-21'), '', 'open comments: nothing open renders nothing');
  const live = loadData().policies.filter((p) => p.comment_deadline);
  ok(live.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.comment_deadline)), 'policies.json: every comment_deadline is YYYY-MM-DD');
  ok(live.every((p) => p.comment_deadline >= p.introduced_date), 'policies.json: no comment_deadline before its introduced_date');
}

if (failures) {
  console.error(`\n${failures} render-static test(s) failed.`);
  process.exit(1);
}
console.log('\nAll render-static tests passed.');

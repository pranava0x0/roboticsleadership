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

const news = bake(readFileSync(resolve(DOCS, 'news.html'), 'utf8'), PAGES['news.html'](RT, data));
const cardCount = (news.match(/class="feed-card"/g) || []).length;
eq(cardCount, RT.NEWS_PAGE_SIZE, 'news.html bakes exactly one client page of cards');
const newest = RT.latestNews(data.news, 1)[0];
ok(news.includes(RT.escapeHTML(newest.title)), 'news.html ships the newest story title in HTML');

const index = bake(readFileSync(resolve(DOCS, 'index.html'), 'utf8'), PAGES['index.html'](RT, data));
const kpis = RT.computeKPIs(data.companies, data.policies, data.supply_chain);
eq((index.match(/class="kpi-card"/g) || []).length, kpis.length, 'index.html bakes every KPI card');
ok(index.includes('id="kpi-strip" class="kpi-strip cols-6"'),
  'index.html bakes the cols-6 modifier, so a no-JS 6-card strip is not laid out for 5');
eq((index.match(/class="feed-card"/g) || []).length, 5, 'index.html bakes the top 5 stories');

// KPI hrefs are hand-written literals, not scraped input. safeURL would reject
// "companies.html?sort=…" (it matches neither ^https?:// nor ^[/.#]) and rewrite
// every card to a dead "#". Assert the links survive — this exact mistake was
// caught in review of the WS0 KPI drill-downs.
ok(index.includes('href="companies.html?sort=funding-desc"'), 'baked KPI cards keep working internal hrefs');

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

if (failures) {
  console.error(`\n${failures} render-static test(s) failed.`);
  process.exit(1);
}
console.log('\nAll render-static tests passed.');

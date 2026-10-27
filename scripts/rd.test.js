#!/usr/bin/env node
/**
 * rd.test.js — integrity checks for docs/data/rd.json and the rd.html page.
 *
 * Three layers:
 *   1. Schema: every record has >=1 http(s) source with a capture date, a
 *      status in the allowed set, and a unique id (via validate.js's validateRd).
 *   2. Adjudications: the research sweep made calls that a later edit could
 *      quietly undo (a vendor number shown as independent, a guessed count,
 *      a third-party comparison we chose not to trust). Each is pinned here.
 *   3. Rendering: the RT.renderRd* functions run in the same bare vm sandbox
 *      the bake uses, and the output keeps the flags and placeholders.
 *
 * No dependencies. Exit 0 = all good; exit 1 = problems found.
 *   node scripts/rd.test.js
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRd, RD_STATUSES } from './validate.js';
import { loadRT } from './render-static.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rd = JSON.parse(readFileSync(resolve(ROOT, 'docs/data/rd.json'), 'utf8'));
const page = readFileSync(resolve(ROOT, 'docs/rd.html'), 'utf8');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const S = rd.sections;
const all = [
  ...S.models, ...S.world_models, ...S.benchmarks,
  ...S.areas.areas.flatMap((a) => a.items), ...S.areas.datasets, ...S.areas.compute,
  ...S.components.prices, ...S.components.bom_shares, ...S.components.facts,
];
const byId = (list, id) => list.find((r) => r.id === id);

console.log('rd.json schema');
test('validateRd passes', () => {
  const r = validateRd('rd', rd);
  assert(r.ok, r.errors.slice(0, 5).join('; '));
});
test('every record has at least one http(s) source', () => {
  const bad = all.filter((r) => !(r.sources || []).some((s) => /^https?:\/\//.test(s.url)));
  assert(!bad.length, `no http(s) source: ${bad.map((r) => r.id).join(', ')}`);
});
test('every status is in the allowed set', () => {
  const bad = all.filter((r) => !RD_STATUSES.includes(r.status));
  assert(!bad.length, `bad status: ${bad.map((r) => `${r.id}=${r.status}`).join(', ')}`);
});
test('no duplicate ids across the file', () => {
  const seen = new Set();
  const dupes = all.map((r) => r.id).filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
  assert(!dupes.length, `duplicate ids: ${dupes.join(', ')}`);
});
test('validateRd catches a missing source, a bad status and a duplicate id', () => {
  const broken = JSON.parse(JSON.stringify(rd));
  broken.sections.models[0].sources = [{ url: 'javascript:alert(1)', captured_at: '2026-10-26' }];
  broken.sections.models[1].status = 'probably';
  broken.sections.models[2].id = broken.sections.models[3].id;
  const r = validateRd('rd', broken);
  const text = r.errors.join('\n');
  assert(!r.ok, 'broken data passed');
  assert(/no http\(s\) source/.test(text), 'missing-source error not reported');
  assert(/status "probably"/.test(text), 'bad-status error not reported');
  assert(/duplicate id/.test(text), 'duplicate-id error not reported');
});

console.log('adjudications');
test('Tesla Optimus hand actuator count is "Not disclosed" (null), not a guessed number', () => {
  const f = byId(S.components.facts, 'comp-42');
  assert(f && /Tesla/.test(f.claim) && /hand/.test(f.claim), 'comp-42 is no longer the Tesla hand fact');
  assert(f.value === null, `value should be null, got ${JSON.stringify(f.value)}`);
});
test('Gemini 4 Argon ERQA 87% is flagged vendor-reported', () => {
  const m = byId(S.models, 'gemini-4-argon');
  const erqa = m && m.results.find((r) => r.benchmark === 'ERQA');
  assert(erqa, 'Argon ERQA result missing');
  assert(erqa.value === '87%', `ERQA value changed: ${erqa.value}`);
  assert(erqa.vendor_reported === true, 'Argon ERQA must be vendor_reported');
});
test('no third-party ERQA comparisons from eesel.ai', () => {
  assert(!JSON.stringify(rd).toLowerCase().includes('eesel'), 'eesel.ai appears in rd.json');
});
test('RLDX-1 carries only the arXiv 86.8% result', () => {
  const m = byId(S.models, 'rldx-1');
  assert(m, 'rldx-1 missing');
  const vals = m.results.map((r) => r.value).join(' | ');
  assert(/86\.8%/.test(vals), `86.8% missing: ${vals}`);
  assert(m.results.length === 1, `expected one result, got: ${vals}`);
});
test('Natura-1 weights are "unknown"', () => {
  const m = byId(S.models, 'natura-1');
  assert(m && m.weights === 'unknown', `weights = ${m && m.weights}`);
});
test('VPP2 is a world model with no ALOHA 58.5% figure', () => {
  assert(!byId(S.models, 'vpp2'), 'VPP2 should not be in models');
  const w = byId(S.world_models, 'vpp2');
  assert(w, 'vpp2 missing from world_models');
  assert(!JSON.stringify(w).includes('58.5'), 'VPP2 still carries 58.5%');
});
test('RoboDojo live board and paper table are separate records with their own dates', () => {
  const live = byId(S.benchmarks, 'robodojo-live');
  const paper = byId(S.benchmarks, 'robodojo-paper');
  assert(live && paper, 'robodojo-live / robodojo-paper missing');
  assert(live.as_of === '2026-10-26', `live as_of = ${live.as_of}`);
  assert(paper.as_of === '2026-07-03', `paper as_of = ${paper.as_of}`);
  assert(/GO-3 Nano/.test(JSON.stringify(live.leaders)), 'live board lost GO-3 Nano Preview');
  assert(/Hy-Embodied-0\.5/.test(JSON.stringify(paper.leaders)), 'paper table lost Hy-Embodied-0.5-VLA');
});
test('BOM shares stay as three separate estimates', () => {
  const ids = S.components.bom_shares.map((b) => b.id).sort();
  assert(JSON.stringify(ids) === JSON.stringify(['bom-bofa', 'bom-mckinsey', 'bom-morgan-stanley']), `bom ids: ${ids}`);
});
test('Screw counts come only from the teardown (no "44 lead screws")', () => {
  assert(!/44 lead screws/i.test(JSON.stringify(rd)), '"44 lead screws" reintroduced');
});
test('36Kr claims are snippet-only', () => {
  const bad = S.components.facts.filter((f) => /36Kr/.test(f.claim) && f.status !== 'snippet-only');
  assert(!bad.length, `36Kr not snippet-only: ${bad.map((f) => f.id).join(', ')}`);
});
test('Spirit removal from RoboChallenge stays a caveat, not a fact', () => {
  const m = byId(S.models, 'spirit-v1-5');
  assert(m, 'spirit-v1-5 missing');
  assert(!/removed from RoboChallenge/i.test(m.summary || ''), 'removal stated as fact in summary');
});

console.log('renderers (bake sandbox)');
const RT = loadRT();
test('every renderer returns HTML without throwing', () => {
  ['renderRdSummary', 'renderRdModels', 'renderRdWorldModels', 'renderRdBenchmarks', 'renderRdAreas', 'renderRdComponents', 'renderRdMethod']
    .forEach((fn) => {
      const html = RT[fn](rd);
      assert(typeof html === 'string' && html.length > 100, `${fn} returned ${typeof html}`);
      assert(!/undefined|\[object Object\]|NaN/.test(html), `${fn} leaked undefined/[object Object]/NaN`);
    });
});
test('Argon ERQA renders with a vendor-reported flag', () => {
  const html = RT.renderRdModels(rd);
  const row = html.slice(html.indexOf('id="gemini-4-argon"'));
  const end = row.indexOf('</tr>');
  assert(/Vendor-reported/.test(row.slice(0, end)), 'Argon row has no Vendor-reported pill');
});
test('Tesla hand count renders "Not disclosed"', () => {
  const html = RT.renderRdComponents(rd);
  const row = html.slice(html.indexOf('id="comp-42"'));
  assert(/Not disclosed/.test(row.slice(0, row.indexOf('</tr>'))), 'comp-42 does not render "Not disclosed"');
});
test('snippet-only records render a Snippet-only flag', () => {
  const html = RT.renderRdComponents(rd);
  const n = S.components.facts.filter((f) => f.status === 'snippet-only').length;
  const shown = (html.match(/id="comp-\d+"[\s\S]*?<\/tr>/g) || []).filter((r) => /Snippet-only/.test(r)).length;
  assert(n > 0 && shown === n, `snippet-only facts ${n}, flagged rows ${shown}`);
});
test('source links come out as hostnames, not raw URLs (URL global present in sandbox)', () => {
  const html = RT.renderRdBenchmarks(rd);
  assert(!/>https?:\/\//.test(html), 'a source chip rendered a full URL');
});
test('summary says counts are not a ranking', () => {
  assert(/not a measure of who leads/.test(RT.renderRdSummary(rd)), 'summary disclaimer missing');
});

console.log('rd.html');
test('page has one tab link and one panel per section, and the tabs point at the panels', () => {
  const tabs = [...page.matchAll(/data-subtab="([a-z-]+)"/g)].map((m) => m[1]);
  assert(JSON.stringify(tabs) === JSON.stringify(['models', 'world-models', 'benchmarks', 'areas', 'components']), `tabs: ${tabs}`);
  tabs.forEach((t) => {
    assert(page.includes(`href="#panel-${t}"`), `tab ${t} has no href`);
    assert(page.includes(`id="panel-${t}"`), `panel-${t} missing`);
  });
});
test('panels ship without the hidden attribute (JS-off: all panels visible)', () => {
  const hidden = [...page.matchAll(/<section[^>]*class="subtab-panel"[^>]*>/g)].filter((m) => /\bhidden\b/.test(m[0]));
  assert(!hidden.length, 'a panel is hidden in the markup');
});
test('R&D nav link is marked aria-current', () => {
  assert(/<a href="rd\.html" aria-current="page">R&amp;D<\/a>/.test(page), 'aria-current R&D link missing');
});
test('footer carries the credit line', () => {
  assert(page.includes('class="footer-credit"') && page.includes('https://pranavaraparla.com') && page.includes('github.com/pranava0x0/roboticsleadership'), 'footer-credit missing');
});
test('method note explains vendor-reported and snippet-only', () => {
  assert(rd.method.vendor_reported.length > 40 && rd.method.snippet_only.length > 40, 'method text too thin');
  assert(/Vendor-reported/.test(RT.renderRdMethod(rd)) && /Snippet-only/.test(RT.renderRdMethod(rd)), 'method note lacks both labels');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

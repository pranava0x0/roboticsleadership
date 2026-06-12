#!/usr/bin/env node
/**
 * us-china.test.js — integrity tests for the US vs China comparison tab.
 *
 * Covers docs/data/us_china.json and the page wiring (china.html exists,
 * every page nav links to it). No dependencies.
 *
 * Usage: node scripts/us-china.test.js
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const DOCS = resolve(ROOT, 'docs');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}\n    ${err.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const data = JSON.parse(readFileSync(resolve(DOCS, 'data/us_china.json'), 'utf8'));

console.log('us_china.json — document integrity');

test('has _meta.last_updated and a sourced BLUF', () => {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(data._meta?.last_updated || ''), `got "${data._meta?.last_updated}"`);
  assert(data.bluf?.headline && data.bluf?.body, 'bluf missing headline/body');
  assert(Array.isArray(data.bluf?.sources) && data.bluf.sources.length > 0, 'bluf has no sources');
});

test('has ≥4 sections with ≥15 metrics total', () => {
  assert(data.sections.length >= 4, `got ${data.sections.length} sections`);
  const total = data.sections.reduce((n, s) => n + s.metrics.length, 0);
  assert(total >= 15, `got ${total} metrics`);
});

test('every metric has us + china values, a valid edge, and ≥1 source URL', () => {
  data.sections.forEach((sec) => sec.metrics.forEach((m) => {
    assert(m.us && m.china, `metric "${m.id}" missing a side`);
    assert(['us', 'china', 'even'].includes(m.edge), `metric "${m.id}" edge "${m.edge}"`);
    assert(Array.isArray(m.sources) && m.sources.length > 0, `metric "${m.id}" has no sources`);
    m.sources.forEach((s) => {
      const url = typeof s === 'string' ? s : s.url;
      assert(/^https?:\/\//.test(url || ''), `metric "${m.id}" has a non-URL source`);
    });
  }));
});

test('no duplicate metric ids across sections', () => {
  const seen = new Set();
  data.sections.forEach((sec) => sec.metrics.forEach((m) => {
    assert(!seen.has(m.id), `duplicate metric id "${m.id}"`);
    seen.add(m.id);
  }));
});

test('unitree case study has ≥5 rows, each sourced', () => {
  assert(data.unitree_case?.rows?.length >= 5, `got ${data.unitree_case?.rows?.length} rows`);
  data.unitree_case.rows.forEach((r) => {
    assert(r.dimension && r.unitree && r.us_oems, `row "${r.dimension}" incomplete`);
    assert(Array.isArray(r.sources) && r.sources.length > 0, `row "${r.dimension}" has no sources`);
  });
});

test('cites the SemiAnalysis Unitree analysis', () => {
  const blob = JSON.stringify(data);
  assert(blob.includes('semianalysis.com'), 'no SemiAnalysis source anywhere in the document');
});

console.log('\npage wiring — china.html');

test('china.html exists and fetches us_china data', () => {
  const html = readFileSync(resolve(DOCS, 'china.html'), 'utf8');
  assert(html.includes('us_china'), 'page does not reference us_china data');
  assert(html.includes('assets/app.js'), 'page does not load app.js');
});

test('every page nav links to china.html', () => {
  const pages = readdirSync(DOCS).filter((f) => f.endsWith('.html'));
  pages.forEach((p) => {
    const html = readFileSync(resolve(DOCS, p), 'utf8');
    assert(html.includes('href="china.html"'), `${p} nav missing china link`);
  });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

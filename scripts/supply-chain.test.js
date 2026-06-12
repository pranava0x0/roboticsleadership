#!/usr/bin/env node
/**
 * supply-chain.test.js — integrity tests for the Supply Chain tab.
 *
 * Covers the data document (docs/data/supply_chain.json) and the page wiring
 * (nav link on every page, page fetches the data file). No dependencies.
 *
 * Usage: node scripts/supply-chain.test.js
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

const data = JSON.parse(readFileSync(resolve(DOCS, 'data/supply_chain.json'), 'utf8'));

console.log('supply_chain.json — document integrity');

test('has _meta.last_updated in YYYY-MM-DD form', () => {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(data._meta?.last_updated || ''), `got "${data._meta?.last_updated}"`);
});

test('overview has bluf with sources and exactly 5 KPIs with label+value+sources', () => {
  assert(typeof data.overview?.bluf === 'string' && data.overview.bluf.length > 50, 'bluf missing or too short');
  assert(Array.isArray(data.overview?.sources) && data.overview.sources.length > 0, 'bluf has no sources');
  assert(Array.isArray(data.overview?.kpis) && data.overview.kpis.length === 5, `expected 5 kpis, got ${data.overview?.kpis?.length}`);
  data.overview.kpis.forEach((k, i) => {
    assert(k.label && k.value, `kpi[${i}] missing label/value`);
    assert(Array.isArray(k.sources) && k.sources.length > 0, `kpi[${i}] "${k.label}" has no sources`);
  });
});

test('chain has ≥5 stages, each with valid us_position and ≥1 source', () => {
  assert(Array.isArray(data.chain_stages) && data.chain_stages.length >= 5, `got ${data.chain_stages?.length} stages`);
  data.chain_stages.forEach((s) => {
    assert(['strong', 'contested', 'weak'].includes(s.us_position), `stage "${s.id}" has us_position "${s.us_position}"`);
    assert(Array.isArray(s.sources) && s.sources.length > 0, `stage "${s.id}" has no sources`);
  });
});

test('every chokepoint is { text, source } with a URL source', () => {
  data.categories.forEach((c) => (c.chokepoints || []).forEach((ck, i) => {
    assert(ck && typeof ck === 'object' && ck.text, `category "${c.id}" chokepoint[${i}] is not { text, source }`);
    assert(/^https?:\/\//.test(ck.source || ''), `category "${c.id}" chokepoint[${i}] has no source URL`);
  }));
});

test('has ≥8 categories, every category cites ≥1 source URL', () => {
  assert(data.categories.length >= 8, `got ${data.categories.length} categories`);
  data.categories.forEach((c) => {
    assert(Array.isArray(c.sources) && c.sources.length > 0, `category "${c.id}" has no sources`);
    c.sources.forEach((s) => {
      const url = typeof s === 'string' ? s : s.url;
      assert(/^https?:\/\//.test(url || ''), `category "${c.id}" has a non-URL source`);
    });
  });
});

test('every category stage exists in chain_stages', () => {
  const stages = new Set(data.chain_stages.map((s) => s.id));
  data.categories.forEach((c) => assert(stages.has(c.stage), `category "${c.id}" → unknown stage "${c.stage}"`));
});

test('share percentages are 0–100 and rows with all three sum to ≤101', () => {
  data.categories.forEach((c) => {
    const parts = [c.us_share_pct, c.china_share_pct, c.row_share_pct];
    parts.forEach((p) => assert(p == null || (typeof p === 'number' && p >= 0 && p <= 100), `category "${c.id}" share out of range`));
    if (parts.every((p) => typeof p === 'number')) {
      const sum = parts.reduce((a, b) => a + b, 0);
      assert(sum <= 101, `category "${c.id}" shares sum to ${sum}`);
    }
  });
});

test('has ≥25 companies; each maps to a real category and cites ≥1 source', () => {
  const cats = new Set(data.categories.map((c) => c.id));
  assert(data.companies.length >= 25, `got ${data.companies.length} companies`);
  data.companies.forEach((c) => {
    assert(c.categories.length > 0 && c.categories.every((id) => cats.has(id)), `company "${c.id}" has unknown category refs`);
    assert(Array.isArray(c.sources) && c.sources.length > 0, `company "${c.id}" has no sources`);
  });
});

test('no duplicate company ids', () => {
  const seen = new Set();
  data.companies.forEach((c) => {
    assert(!seen.has(c.id), `duplicate company id "${c.id}"`);
    seen.add(c.id);
  });
});

test('financing entries have YYYY-MM dates and numeric/null amounts', () => {
  data.companies.forEach((c) => (c.financing || []).forEach((f, i) => {
    assert(/^\d{4}(-\d{2})?$/.test(f.date || ''), `company "${c.id}" financing[${i}] date "${f.date}"`);
    assert(f.amount_usd == null || typeof f.amount_usd === 'number', `company "${c.id}" financing[${i}] amount not numeric`);
  }));
});

test('stakeholder map covers the 5 canonical groups', () => {
  const groups = data.stakeholders.map((g) => g.group);
  ['Government', 'Coalitions & Advocacy', 'Investors', 'OEMs & Demand', 'Research & Talent'].forEach((g) =>
    assert(groups.includes(g), `missing stakeholder group "${g}"`));
});

test('every stakeholder entity has role + ≥1 source URL', () => {
  data.stakeholders.forEach((g) => g.entities.forEach((e) => {
    assert(e.role, `entity "${e.name}" missing role`);
    assert(Array.isArray(e.sources) && e.sources.length > 0, `entity "${e.name}" has no sources`);
  }));
});

test('facts and government_programs all carry source URLs', () => {
  (data.facts || []).forEach((f) => assert(/^https?:\/\//.test(f.source || ''), `fact "${f.label}" has no source URL`));
  (data.government_programs || []).forEach((p) => assert(/^https?:\/\//.test(p.source || ''), `program "${p.name}" has no source URL`));
});

console.log('\npage wiring — supply-chain.html');

test('supply-chain.html exists and fetches supply_chain data', () => {
  const html = readFileSync(resolve(DOCS, 'supply-chain.html'), 'utf8');
  assert(html.includes('supply_chain'), 'page does not reference supply_chain data');
  assert(html.includes('assets/app.js'), 'page does not load app.js');
});

test('every page nav links to supply-chain.html', () => {
  const pages = readdirSync(DOCS).filter((f) => f.endsWith('.html'));
  pages.forEach((p) => {
    const html = readFileSync(resolve(DOCS, p), 'utf8');
    assert(html.includes('href="supply-chain.html"'), `${p} nav missing supply-chain link`);
  });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

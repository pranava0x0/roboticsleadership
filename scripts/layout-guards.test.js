#!/usr/bin/env node
/**
 * layout-guards.test.js — regression guards for the 2026-09-25 scroll-depth and
 * mobile-overflow fixes. Text-level checks on the page source; the rendered numbers
 * (screens per page) come from scripts/uat-scroll-probe.js in a browser.
 *
 * Usage: node scripts/layout-guards.test.js
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(resolve(ROOT, 'docs', f), 'utf8');

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

const supply = read('supply-chain.html');
const companies = read('companies.html');
const supplyData = JSON.parse(read('data/supply_chain.json'));

console.log('layout guards');

test('supply-chain category tables sit inside .table-wrap (a bare table overflowed 375px, 2026-09-25)', () => {
  const block = supply.slice(supply.indexOf('function categoryBlock'));
  const i = block.indexOf('<table class="data-table">');
  assert(i > 0, 'category table template not found');
  assert(/<div class="table-wrap">\s*$/.test(block.slice(0, i)), 'category table is not wrapped in .table-wrap');
});

test('supply-chain long sections are collapsed by default', () => {
  assert(!/id="sec-us-sites"[^>]*\bopen\b/.test(supply), 'sec-us-sites ships open');
  assert(!/id="stage-\$\{RT\.slug\(stage\.id\)\}"[^>]*\bopen\b/.test(supply), 'stage sections ship open');
});

test('companies directory is capped and offers Show more / Show all', () => {
  assert(/const PAGE = 25;/.test(companies), 'PAGE cap missing');
  assert(/rows\.slice\(0, shown\)/.test(companies), 'rows are not sliced by the cap');
  assert(/id="more-btn"/.test(companies) && /id="all-btn"/.test(companies), 'more/all buttons missing');
});

test('companies filter listeners reset the cap (they must not pass the Event as keepShown)', () => {
  assert(/addEventListener\(ev, \(\) => render\(\)\)/.test(companies), 'filter listener passes its event to render()');
});

test('policies executive table is capped, offers Show more / Show all, and filter listeners reset the cap', () => {
  const policies = read('policies.html');
  assert(/const EXEC_PAGE = 15;/.test(policies), 'EXEC_PAGE cap missing');
  assert(/executiveRows\.slice\(0, execShown\)/.test(policies), 'executive rows are not sliced by the cap');
  assert(/id="exec-more-btn"/.test(policies) && /id="exec-all-btn"/.test(policies), 'more/all buttons missing');
  assert(/addEventListener\(ev, \(\) => render\(\)\)/.test(policies), 'filter listener passes its event to render()');
});

test('energy application areas are collapsible <details>, only the first ships open, and the filter restores their state', () => {
  const energy = read('energy.html');
  assert(/<details class="collapsible-section e-section" id="\$\{id\}" \$\{firstSection \? 'open' : ''\}>/.test(energy), 'sections are not details with a first-only open flag');
  assert(/prevOpen/.test(energy), 'filter does not remember and restore section state');
  assert(/target\.tagName === 'DETAILS'\) target\.open = true/.test(energy), 'jump chips do not open their target');
});

test('front page loads the trimmed news payload, never the whole archive', () => {
  const index = read('index.html');
  assert(!/RT\.loadAll\(\)/.test(index), 'index.html loads everything via loadAll()');
  assert(/RT\.loadNewsRecent\(\)/.test(index), 'index.html does not use loadNewsRecent()');
  assert(!/href="data\/news\.json"/.test(index), 'index.html still preloads data/news.json');
});

test('production_trend: one row per year, ascending, projections only after actuals, latest actual matches the industrial shipments row', () => {
  const t = supplyData.production_trend;
  const years = t.map((r) => Number(r.year));
  assert(years.every((y, i) => i === 0 || y === years[i - 1] + 1), `years not consecutive ascending: ${years.join(',')}`);
  const firstProjected = t.findIndex((r) => r.projected);
  assert(firstProjected === -1 || t.slice(firstProjected).every((r) => r.projected), 'an actual row follows a projected row');
  const lastActual = [...t].reverse().find((r) => !r.projected);
  const ship = supplyData.shipments.find((s) => s.id === 'industrial');
  assert(String(lastActual.year) === String(ship.year), `latest actual year ${lastActual.year} != shipments.industrial.year ${ship.year}`);
  const sum = lastActual.us_units + lastActual.china_units + lastActual.row_units;
  assert(Math.abs(sum - ship.units) <= 1, `latest actual row sums to ${sum}, shipments.industrial.units is ${ship.units}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

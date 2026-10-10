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
  assert(/autoOpened/.test(energy) && /!d\.dataset\.autoOpened/.test(read('assets/app.js')), 'filter-opened sections are persisted as if the reader chose them');
});

test('front page loads the trimmed news payload, never the whole archive', () => {
  const index = read('index.html');
  assert(!/RT\.loadAll\(\)/.test(index), 'index.html loads everything via loadAll()');
  assert(/RT\.loadNewsRecent\(\)/.test(index), 'index.html does not use loadNewsRecent()');
  assert(!/href="data\/news\.json"/.test(index), 'index.html still preloads data/news.json');
});

test('news page first-paints from the trimmed payload and only fetches the full archive on demand (2026-10-02, was 259/260 KB gzip)', () => {
  const news = read('news.html');
  assert(!/href="data\/news\.json"/.test(news), 'news.html still preloads the full archive instead of data/news-recent.json');
  assert(/href="data\/news-recent\.json"/.test(news), 'news.html does not preload data/news-recent.json');
  assert(/RT\.loadNewsRecent\(\)/.test(news), 'news.html does not call RT.loadNewsRecent() for first paint');
  assert(/function ensureFullNews/.test(news), 'news.html has no lazy full-archive loader');
  assert(/await ensureFullNews\(\)/.test(news), 'renderNewsFeed never awaits the lazy full-archive loader');

  // A <select>'s .value assignment silently no-ops when no <option> has that
  // value yet. Since the company/category <select>s are now built from the
  // recent-60 window first, restoring ?company=<id> for the ~80% of tracked
  // companies absent from that window would otherwise revert to "All
  // companies" with no error, no warning, and no visible difference from a
  // typo'd id — caught in review of this same change, not by the test suite.
  assert(/some\(\(o\) => o\.value === q\[k\]\)/.test(news), 'query-string filter restore no longer guards against a missing <option> for the recent-60-only select');
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

test('physical-ai-action-plan: later sections ship collapsed, and print opens them', () => {
  // The page was 15.0 phone screens (budget 15). Sections 4-9 are details so the
  // page is a few taps rather than a scroll; a closed <details> would drop out of
  // a printed copy, so the beforeprint handler must reopen them.
  const html = read('physical-ai-action-plan.html');
  const closed = html.match(/<details class="collapsible-section plan-sheet" id="sec-[a-z-]+">/g) || [];
  assert(closed.length >= 6, `expected >= 6 collapsed plan sections, found ${closed.length}`);
  assert(!/<details class="collapsible-section plan-sheet"[^>]*\bopen\b/.test(html), 'a collapsed plan section is authored open');
  assert(/beforeprint/.test(html) && /details\.plan-sheet/.test(html), 'beforeprint handler that reopens plan sections is gone');
  assert(/afterprint/.test(html), 'afterprint no longer restores the pre-print state (the open toggles would otherwise persist to localStorage)');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

test('energy: Project Prime Mover ships collapsed, and print opens it', () => {
  // Always-visible draft RFI pushed energy.html to 14.4 phone screens (budget 15).
  const html = read('energy.html');
  assert(/<details class="collapsible-section e-section" id="prime-mover"(?![^>]*\bopen\b)/.test(html), 'prime-mover is not a closed details');
  assert(/beforeprint/.test(html) && /afterprint/.test(html), 'energy.html lost its print handler for collapsed sections');
});

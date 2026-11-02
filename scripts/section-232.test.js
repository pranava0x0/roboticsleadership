#!/usr/bin/env node
// Contracts for section-232-robotics.html, the explainer for the Oct 28, 2026
// Section 232 proclamation on robotics and industrial machinery.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = resolve(ROOT, 'docs');
const read = (f) => readFileSync(resolve(DOCS, f), 'utf8');
const PAGE = 'section-232-robotics.html';
const html = read(PAGE);

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name}\n  ${e.message}`); }
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

test('every page links the tab exactly once, right after Policy', () => {
  for (const f of readdirSync(DOCS).filter((x) => x.endsWith('.html'))) {
    const page = read(f);
    const links = page.match(/<li><a href="section-232-robotics\.html">/g) || [];
    assert.equal(links.length, 1, `${f}: ${links.length} nav links`);
    assert(/<li><a href="policies\.html">Policy<\/a><\/li>\s*<li><a href="section-232-robotics\.html">/.test(page), `${f}: tab not after Policy`);
  }
});

test('head carries its own canonical, OG and Twitter meta', () => {
  const url = `https://pranava0x0.github.io/roboticsleadership/${PAGE}`;
  assert(html.includes(`<link rel="canonical" href="${url}" />`), 'canonical');
  assert(html.includes(`<meta property="og:url" content="${url}" />`), 'og:url');
  assert(/<meta property="og:title" content="Section 232/.test(html), 'og:title');
  assert(html.includes('assets/share-card.png'), 'share card');
  assert(html.includes('<meta name="twitter:card" content="summary_large_image" />'), 'twitter card');
});

test('footer credit links the site and the repo', () => {
  assert(/<p class="footer-credit"><a href="https:\/\/pranavaraparla\.com">/.test(html));
  assert(html.includes('https://github.com/pranava0x0/roboticsleadership'));
});

// Computed deadlines carry their arithmetic: data-from + data-days must equal
// data-date. A typo in a hand-written date would otherwise ship silently.
test('computed timeline dates equal their base date plus the stated days', () => {
  const rows = [...html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})" data-from="(\d{4}-\d{2}-\d{2})" data-days="(-?\d+)"/g)];
  assert(rows.length >= 3, `only ${rows.length} computed rows`);
  for (const [, date, from, days] of rows) assert.equal(addDays(from, Number(days)), date, `${from} + ${days}`);
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const display = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };

// The reader sees the first cell, not data-date; the two must agree except on
// the one row whose date is not known yet.
test('each dated row shows the date in its data-date', () => {
  const rows = [...html.matchAll(/<tr[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*>\s*<td[^>]*>(.*?)<\/td>/g)];
  assert(rows.length >= 12, `only ${rows.length} dated rows`);
  for (const [, iso, cell] of rows) {
    const text = cell.replace(/<[^>]+>/g, '').trim();
    if (text === 'Not yet') continue;
    assert.equal(text, display(iso), `row ${iso} shows "${text}"`);
  }
});

test('the 180-day update date is the one stated everywhere', () => {
  const due = addDays('2026-10-28', 180);
  assert.equal(due, '2027-04-26');
  for (const f of [PAGE, 'index.html']) assert(read(f).includes('Apr 26, 2027') || read(f).includes('April 26, 2027'), `${f} lacks the update date`);
  const policies = JSON.parse(read('data/policies.json'));
  const rec = policies.find((p) => p.id === 'proc-2026-10-28-robotics-232');
  assert(rec, 'policy record missing');
  assert(rec.summary.includes('April 26, 2027'), 'policy summary lacks the update date');
  const story = JSON.parse(read('data/news.json')).find((n) => n.id === 'section-232-robotics-proclamation-2026-10');
  assert(story && story.summary.includes('April 26, 2027'), 'news summary lacks the update date');
  assert(story.policies.includes(rec.id), 'news record does not link the policy record');
});

test('each timeline table is in date order', () => {
  const tables = html.split('<table').filter((t) => t.includes('data-date='));
  assert(tables.length >= 2, `only ${tables.length} dated tables`);
  for (const t of tables) {
    const dates = [...t.matchAll(/<tr[^>]*data-date="(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]);
    assert(dates.length >= 5, `only ${dates.length} dated rows`);
    assert.deepEqual(dates, [...dates].sort(), 'timeline out of order');
  }
});

test('external links are https and open safely', () => {
  const hrefs = [...html.matchAll(/href="(https?:[^"]+)"/g)].map((m) => m[1]);
  assert(hrefs.length >= 20, `only ${hrefs.length} external links`);
  for (const h of hrefs) assert(h.startsWith('https://'), `insecure link ${h}`);
  for (const tag of html.match(/<a [^>]*target="_blank"[^>]*>/g) || []) assert(/rel="noopener"/.test(tag), `missing noopener: ${tag}`);
});

test('long sections ship collapsed, jump chips and print open them', () => {
  const sections = html.match(/<details class="collapsible-section" id="[a-z-]+"[^>]*>/g) || [];
  assert(sections.length >= 5, `expected >= 5 collapsible sections, found ${sections.length}`);
  assert(sections.every((s) => !/\sopen(?=[\s>=])/.test(s.replace(/id="[^"]*"/, ''))), 'a collapsible section is authored open');
  assert(/beforeprint/.test(html) && /afterprint/.test(html), 'print handler gone');
  assert(/jump-nav/.test(html) && /target\.open = true/.test(html), 'jump chips no longer open their target');
});

test('front page points at the page', () => {
  assert(read('index.html').includes('href="section-232-robotics.html"'));
});

test('sitemap and llms.txt list the page', () => {
  assert(read('sitemap.xml').includes(`/${PAGE}</loc>`));
  assert(read('llms.txt').includes(`/${PAGE})`));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

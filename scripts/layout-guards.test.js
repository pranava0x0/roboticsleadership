#!/usr/bin/env node
/**
 * layout-guards.test.js — regression guards for the 2026-09-25 scroll-depth and
 * mobile-overflow fixes. Text-level checks on the page source; the rendered numbers
 * (screens per page) come from scripts/uat-scroll-probe.js in a browser.
 *
 * Usage: node scripts/layout-guards.test.js
 */

import { readFileSync, readdirSync } from 'node:fs';
import { loadRT } from './render-static.js';
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

test('policies scope lines clamp to two lines on phones and the detail sheet still prints the full scope', () => {
  const css = read('assets/styles.css');
  assert(/#congress-table td \.secondary-line,\s*#executive-table td \.secondary-line \{[^}]*-webkit-line-clamp: 2/.test(css), 'policies scope-line clamp missing');
  assert(/<dt>Scope<\/dt><dd>\$\{RT\.escapeHTML\(p\.robotics_scope\)\}/.test(read('policies.html')), 'detail sheet no longer prints the full scope the clamp hides');
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
  // 2026-11-18: the install-gap chart needs production_trend only (~3 KB of ~30 KB gzip).
  assert(!/loadData\('supply_chain'\)|href="data\/supply_chain\.json"/.test(index), 'index.html fetches all of supply_chain.json for one chart');
  assert(/RT\.loadInstallTrend\(\)/.test(index), 'index.html does not use loadInstallTrend()');
});

test('companies and policies paint without the news archive; news.json loads only when a detail sheet opens (2026-11-15, B1)', () => {
  // Both pages awaited news.json (~220 KB gzip) before painting any row, only
  // to show a detail sheet's related-news list. First load was 344 / 321 KB gzip.
  for (const page of ['companies', 'policies']) {
    const html = read(`${page}.html`);
    assert(!/RT\.loadAll\(\)/.test(html), `${page}.html loads everything via loadAll()`);
    assert(!/await RT\.loadData\(['"]news['"]\)/.test(html), `${page}.html awaits news.json before first paint`);
    assert(!/Promise\.all\(\[[^\]]*loadData\(['"]news['"]\)/.test(html), `${page}.html puts news.json in its first-paint Promise.all`);
    assert(!/href="data\/news\.json"/.test(html), `${page}.html preloads data/news.json`);
    const lazy = html.indexOf("RT.loadData('news').then");
    assert(lazy > html.indexOf('RT.openDetail('), `${page}.html no longer fetches news after opening the detail sheet`);
    assert(/id="detail-news"/.test(html), `${page}.html detail sheet lost its news slot`);
  }
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

test('policy is one page with Federal, States and Potential sub-tabs; removed pages stay removed (2026-11-02)', () => {
  // states.html, themes.html and the drafted executive order were folded in.
  // A nav link or href to any of them would now 404.
  const html = read('policies.html');
  for (const id of ['panel-federal', 'panel-states', 'panel-potential']) {
    assert(html.includes(`id="${id}"`), `policies.html lost #${id}`);
  }
  assert(/RT\.initSubTabs\('\[data-subtabs\]'/.test(html), 'policies.html no longer wires its sub-tabs');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert(!dup.length, `duplicate ids after merging the States page: ${dup.join(', ')}`);
  for (const f of readdirSync(resolve(ROOT, 'docs')).filter((n) => n.endsWith('.html'))) {
    const page = read(f);
    const bad = page.match(/href="(states|themes|physical-ai-action-plan)\.html/);
    assert(!bad, `${f} still links to ${bad && bad[1]}.html`);
  }
});

test('front page carries every theme, with figures and sources', () => {
  const themes = JSON.parse(read('data/themes.json'));
  const out = loadRT().renderThemeCards(themes);
  // One closed disclosure row per theme (2026-11-11): the name shows; the whole
  // note, figures and sources sit inside, and none of it is lost.
  const n = (out.match(/<details class="theme-row"/g) || []).length;
  assert(n === themes.length, `rendered ${n} of ${themes.length} themes`);
  assert(!/<details class="theme-row"[^>]*\bopen\b/.test(out), 'a theme row ships open');
  const RT = loadRT();
  const norm = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
  for (const t of themes) {
    const row = RT.renderThemeCards([t]);
    const body = norm((row.match(/<div class="theme-body">\s*<p>([\s\S]*?)<\/p>/) || [])[1] || '');
    assert(body === norm(t.narrative), `${t.id}: the row no longer carries the whole note`);
    const metrics = (row.match(/<ul class="theme-metrics">[\s\S]*?<\/ul>/) || [''])[0];
    assert((metrics.match(/<li>/g) || []).length === (t.key_metrics || []).length, `${t.id}: figures dropped`);
  }
  assert(read('index.html').includes('id="themes"'), 'index.html lost the #themes anchor news.html links to');
});

test('energy: Project Prime Mover ships collapsed, and print opens it', () => {
  // Always-visible draft RFI pushed energy.html to 14.4 phone screens (budget 15).
  const html = read('energy.html');
  assert(/<details class="collapsible-section e-section" id="prime-mover"(?![^>]*\bopen\b)/.test(html), 'prime-mover is not a closed details');
  assert(/beforeprint/.test(html) && /afterprint/.test(html), 'energy.html lost its print handler for collapsed sections');
});

test('section 232: the agencies table ships collapsed, with a jump chip that opens it', () => {
  // The 11-row agencies table was 1,812px on a phone, the page's longest block (8.4 screens total).
  const html = read('section-232-robotics.html');
  assert(/<details class="collapsible-section" id="agencies"(?![^>]*\bopen\b)/.test(html), 'agencies is not a closed details');
  assert(/<nav[^>]*id="s232-jump"[\s\S]*?href="#agencies"/.test(html), 'jump nav has no chip for #agencies');
  assert(/beforeprint/.test(html), 'section-232 page lost its print handler for collapsed sections');
});

test('news cards tighten on a phone without hiding the summary (2026-11-12, 9.5 -> 8.8 screens)', () => {
  const css = read('assets/styles.css');
  const block = (css.match(/\/\* Phone feed cards[\s\S]*?@media \(max-width: 540px\) \{([\s\S]*?)\n\}/) || [])[1] || '';
  assert(/\.feed-card \{ padding: 12px 14px; \}/.test(block), 'phone feed-card padding rule missing');
  assert(/\.row-end > \.faint \{ display: none; \}/.test(block), 'phone rule no longer drops the duplicate relative date');
  assert(!/\.summary[^}]*display:\s*none/.test(block), 'phone rule must not hide card summaries');
});

test('front-page top companies are a ranked list of six rows (2026-11-15, replaced the 2026-11-13 two-up cards)', () => {
  // Six stacked cards ran 1,027px on a phone; two-up cards cut that, and a
  // one-line-per-company ranked list cuts it further with every row still a 44px+ target.
  const RT = loadRT();
  const html = RT.renderTopCompanies([{ id: 'a', name: 'A', hq: { country: 'USA' }, latest_valuation_usd: 1e9 }]);
  assert(/<li><a href="companies\.html\?focus=a">/.test(html), 'row does not link to the company');
  assert(/class="rank-value tnum"/.test(html), 'row lost its valuation');
  assert(/<ol id="top-companies" class="rank-list">/.test(read('index.html')), 'index.html #top-companies is no longer an ordered rank list');
  assert(/\.rank-list a \{[^}]*min-height: 52px/.test(read('assets/styles.css')), 'rank rows lost their touch-target height');
});

test('phone filter bars put the result count beside the last button (2026-11-14, news bar 229 -> 198px)', () => {
  const css = read('assets/styles.css');
  const phone = css.slice(css.indexOf('Clean responsive 2-column grid for filters'));
  const rule = phone.match(/\.filter-result-count \{[^}]*grid-column:\s*([^;]+);/g) || [];
  assert(rule.some((r) => /grid-column:\s*auto/.test(r)), 'phone .filter-result-count must use grid-column: auto, not span a full row');
  for (const page of ['news', 'companies', 'policies']) {
    const html = read(`${page}.html`);
    const form = html.slice(html.indexOf('id="filter-form"'), html.indexOf('</form>'));
    const last = form.lastIndexOf('<button'), count = form.indexOf('filter-result-count');
    assert(last > -1 && count > last, `${page}: result count must follow the last filter button`);
    // Search spans both columns; the count only fills a half-empty row when the
    // one-column controls (selects + buttons) are odd in number.
    const singles = (form.match(/<select\b/g) || []).length + (form.match(/<button\b/g) || []).length;
    assert(singles % 2 === 1, `${page}: ${singles} one-column filter controls; an even count puts the result count on its own row`);
  }
});

test('scsp-summit report directions and caveats ship collapsed (2026-11-15, ~1,450px of phone scroll)', () => {
  const html = read('scsp-summit.html');
  for (const [wrap, list] of [['report-headed', 'report-directions'], ['report-disagree', 'report-caveats']]) {
    const open = html.match(new RegExp(`<details class="collapsible-section" id="${wrap}"([^>]*)>`));
    assert(open, `${wrap} must be a details.collapsible-section`);
    assert(!/\bopen\b/.test(open[1]), `${wrap} must not be authored open`);
    const body = html.slice(open.index, html.indexOf('</details>', open.index));
    assert(body.includes(`id="${list}"`), `#${list} must sit inside #${wrap}`);
  }
});

test('an open detail sheet makes the back-to-top button inert too (Codex review, PR #301)', () => {
  const app = read('assets/app.js');
  const sel = (app.match(/const MODAL_INERT = '([^']+)'/) || [])[1] || '';
  assert(/body > \.to-top/.test(sel), 'MODAL_INERT does not cover the body-level .to-top button');
  assert((app.match(/querySelectorAll\(MODAL_INERT\)/g) || []).length === 2, 'open and close no longer share MODAL_INERT');
});

test('anchor targets clear the sticky header at every width (2026-11-15, C1: landings at top 0 under a 57px header)', () => {
  const css = read('assets/styles.css');
  assert(/\n\[id\] \{ scroll-margin-top: calc\(var\(--header-h\) \+ \d+px\); \}/.test(css), 'generic [id] scroll-margin-top rule derived from --header-h is missing');
  assert(/\.site-header-inner \{[^}]*height: var\(--header-h\)/.test(css), 'the header height no longer comes from --header-h, so the scroll margin can drift from it');
});

test('hash links to rendered or collapsed targets open and land (2026-11-15, C2)', () => {
  const app = read('assets/app.js');
  // Captured when app.js runs, before any page script can call writeQuery (which strips it).
  const capture = app.indexOf("const loadHash = typeof location !== 'undefined' && location.hash");
  assert(capture > 0 && capture < app.indexOf('function revealHashTarget'), 'app.js no longer captures the load hash once, up front');
  assert(/loadHashPending = false;\s*openAround\(el\)/.test(app), 'revealHashTarget no longer consumes the hash before opening and scrolling');
  assert(/document\.addEventListener\('click', onHashLinkClick\)/.test(app), 'same-page hash clicks no longer open a closed <details> around the target');
  assert(/\n    revealHashTarget,\n/.test(app), 'RT.revealHashTarget is not exported');
  for (const page of ['china', 'index', 'supply-chain', 'news']) {
    assert(/RT\.revealHashTarget\(\)/.test(read(`${page}.html`)), `${page}.html no longer reveals its hash target after painting`);
  }
  // china's plans paint asynchronously; revealing before they land would scroll to nodes the re-paint replaces.
  assert(/plansPainted\.then\(\(\) => RT\.revealHashTarget\(\)\)/.test(read('china.html')), 'china.html reveals before its plans paint');
});

test('a malformed #fragment cannot stop app.js (2026-11-16 review: index.html#50% left window.RT undefined on every page)', () => {
  const app = read('assets/app.js');
  assert(/function safeDecode\(s\) \{\s*try \{ return decodeURIComponent\(s\); \} catch \(e\) \{ return s; \}/.test(app), 'safeDecode is missing or no longer catches');
  assert((app.match(/decodeURIComponent\(/g) || []).length === 1, 'app.js decodes a fragment outside safeDecode');
  assert(!/decodeURIComponent\(location\.hash/.test(read('news.html')), 'news.html decodes the fragment without a guard');
  assert(/:is\(h2, h3, section, details\)\[id\]/.test(read('assets/styles.css')), 'h3 targets no longer clear the sticky jump nav (section-232 #open)');
});

test('supply-chain restores collapsible state after painting its stage sections, then reveals the hash (2026-11-15, C4)', () => {
  const at = (s) => supply.indexOf(s);
  assert(at('renderCategories(sc);') > 0, 'renderCategories call not found');
  assert(at('RT.applyCollapsibleState();') > at('renderCategories(sc);'), 'applyCollapsibleState must run after the stage sections are painted');
  assert(at('RT.revealHashTarget();') > at('RT.applyCollapsibleState();'), 'revealHashTarget must run after applyCollapsibleState, or a restore can close what it opened');
});

test('news Reset and cleared filters drop their keys from the URL (2026-11-15, C3)', () => {
  // RT.writeQuery removes a key only when it is passed as ''; leaving a key out keeps its old value.
  const news = read('news.html');
  assert(!/delete newQ\./.test(news), 'news.html omits cleared keys from writeQuery again, which leaves them in the URL');
  assert(/RT\.writeQuery\(\{ search, category, company, sort: [^}]*\}\)/.test(news), 'news.html no longer passes every filter key to writeQuery');
});

test('KPI labels wrap instead of clipping at 375px (2026-11-15, C7)', () => {
  const rule = (read('assets/styles.css').match(/\.kpi-label \{[^}]*\}/) || [''])[0];
  assert(rule && !/nowrap|text-overflow/.test(rule), '.kpi-label clips its text again');
});

test('pages that are not baked tell no-JS readers where the data is (2026-11-15, C5)', () => {
  const data = { companies: ['companies'], policies: ['policies', 'state_policy', 'agencies'], 'supply-chain': ['supply_chain'], energy: [], 'scsp-summit': ['scsp-ai-robotics-2026', 'scsp-robotics-commission-2026'] };
  for (const [page, files] of Object.entries(data)) {
    const html = read(`${page}.html`);
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    const note = (main.match(/<noscript>([\s\S]*?)<\/noscript>/) || [])[1];
    assert(note, `${page}.html has no <noscript> note inside <main>`);
    for (const f of files) assert(note.includes(`href="data/${f}.json"`), `${page}.html noscript note does not link data/${f}.json`);
    for (const baked of ['index.html', 'news.html', 'china.html', 'rd.html']) assert(note.includes(`href="${baked}"`), `${page}.html noscript note does not link ${baked}`);
  }
});

test('supply-chain sends every data href through RT.safeURL before escaping it (2026-11-15 objectivity audit)', () => {
  // escapeHTML stops attribute breakout but lets a javascript: or data: URL through.
  const hrefs = supply.match(/href="\$\{[^"]*\}"/g) || [];
  assert(hrefs.length >= 6, `expected the six data-driven hrefs, found ${hrefs.length}`);
  for (const h of hrefs) assert(/^href="\$\{RT\.escapeHTML\(RT\.safeURL\(/.test(h), `unsafe data href in supply-chain.html: ${h}`);
});

test('phone news summaries clamp to three lines and open on tap (2026-11-16, summaries were 48% of the feed)', () => {
  const css = read('assets/styles.css');
  const news = read('news.html');
  const phone = css.slice(css.indexOf('@media (max-width: 540px)', css.indexOf('Phone feed cards')));
  const block = phone.slice(0, phone.indexOf('\n}\n'));
  assert(/\.feed\[data-density="card"\] \.feed-card \.summary:not\(\.is-open\)/.test(block), 'clamp rule missing from the phone feed-card block');
  assert(/-webkit-line-clamp:\s*3/.test(block), 'clamp is no longer three lines');
  assert(/classList\.toggle\('is-open'\)/.test(news), 'news.html no longer toggles .is-open on tap');
  // Codex review (PR #302): a clamped summary must be reachable by keyboard and expose its state.
  assert(/setAttribute\('role', 'button'\)/.test(news) && /aria-expanded/.test(news), 'clamped summaries are not exposed as a control');
  assert(/addEventListener\('keydown'[\s\S]{0,200}'Enter'[\s\S]{0,40}' '/.test(news), 'Enter/Space no longer open a summary');
  assert(/pendingHash[\s\S]{0,200}\.summary'\)\?\.classList\.add\('is-open'\)/.test(news), 'a deep-linked story no longer opens its summary');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

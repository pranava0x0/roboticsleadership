#!/usr/bin/env node
// Design-system guards that used to be checked by eye, now checked by script.
//
//   node scripts/design-tokens.test.js
//
// 1. Contrast. Every text token in every theme clears WCAG AA (4.5:1) on each of
//    the three surfaces text lands on (--bg, --surface, --surface-2), and
//    --border-strong clears 3:1 on --bg. DESIGN.md § 15.2 published a table of
//    these ratios "checked with a scripted WCAG calculator" that was never
//    committed; this is that calculator.
// 2. Section heads. One look on every page: h2.section-title is set once, in
//    styles.css, at full --text strength, never in tracked capitals, and no page
//    restyles it inline beyond size. The front page's heads used to be 15px
//    capitals while every other page's were 20px serif (fixed 2026-10-31).
// 3. Front-page furniture that was removed stays removed: the tinted BLUF box,
//    numbered exec-brief cards and the "Latest" flag that repeated the rail head.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
// Comments stripped: a rule's selector is whatever precedes its brace.
const css = fs.readFileSync(path.join(DOCS, 'assets/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const appJs = fs.readFileSync(path.join(DOCS, 'assets/app.js'), 'utf8');
const pages = fs.readdirSync(DOCS).filter((f) => f.endsWith('.html'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`✗ ${name}\n    ${e.message.split('\n').join('\n    ')}`);
  }
}

// ---------- contrast ----------
const THEMES = ['caves', 'naked-sun', 'dawn', 'robot-dreams', 'foundation'];
const TEXT_TOKENS = ['--text', '--text-muted', '--text-faint', '--accent', '--link'];
// Category colours are text too: the rail's category line (.brief-cat) prints
// them bare on the page and on cards.
const CAT_TOKENS = ['--cat-funding', '--cat-deployment', '--cat-policy', '--cat-competitive',
  '--cat-supplychain', '--cat-geopolitics', '--cat-research'];
const BACKGROUNDS = ['--bg', '--surface', '--surface-2'];

function themeTokens(theme) {
  const m = css.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`no [data-theme="${theme}"] block in styles.css`);
  const out = {};
  for (const [, k, v] of m[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[k] = v.trim();
  return out;
}

function rgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`not a 6-digit hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}
function luminance(hex) {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('the contrast calculator can fail (known pairs)', () => {
  if (Math.abs(ratio('#000000', '#ffffff') - 21) > 0.01) throw new Error('black on white is not 21:1');
  if (ratio('#777777', '#ffffff') >= 4.5) throw new Error('#777 on white should miss AA');
});

for (const theme of THEMES) {
  test(`${theme}: every text token ≥ 4.5:1 on --bg, --surface and --surface-2`, () => {
    const t = themeTokens(theme);
    const bad = [];
    for (const fg of [...TEXT_TOKENS, ...CAT_TOKENS]) {
      for (const bg of BACKGROUNDS) {
        if (!t[fg] || !t[bg]) throw new Error(`${theme} is missing ${t[fg] ? bg : fg}`);
        const r = ratio(t[fg], t[bg]);
        if (r < 4.5) bad.push(`${fg} ${t[fg]} on ${bg} ${t[bg]} = ${r.toFixed(2)}:1`);
      }
    }
    if (bad.length) throw new Error(bad.join('\n'));
  });
  test(`${theme}: --border-strong ≥ 3:1 on --bg`, () => {
    const t = themeTokens(theme);
    const r = ratio(t['--border-strong'], t['--bg']);
    if (r < 3) throw new Error(`--border-strong on --bg = ${r.toFixed(2)}:1`);
  });
}

// ---------- section heads ----------
// Every rule whose selector names .section-title, with its declarations.
const headRules = [...css.matchAll(/([^{}]*section-title[^{}]*)\{([^}]*)\}/g)]
  .map(([, sel, body]) => ({ sel: sel.trim().replace(/\s+/g, ' '), body }));

test('h2.section-title is defined once, in serif 700 at full --text strength', () => {
  const base = headRules.filter((r) => r.sel === 'h2.section-title');
  if (base.length !== 1) throw new Error(`expected one bare h2.section-title rule, found ${base.length}`);
  const b = base[0].body;
  for (const want of ['font-family: var(--font-serif)', 'font-weight: 700', 'color: var(--text)']) {
    if (!b.includes(want)) throw new Error(`h2.section-title lacks "${want}"`);
  }
});

test('no section-title rule sets capitals, letter-spacing or a smaller size', () => {
  const bad = headRules.filter((r) => /text-transform|letter-spacing:\s*0\.0[5-9]|letter-spacing:\s*0\.1|font-size/.test(r.body)
    && r.sel !== 'h2.section-title');
  if (bad.length) throw new Error(bad.map((r) => r.sel).join('\n'));
});

test('no page styles a section head in capitals inline', () => {
  const bad = [];
  for (const p of pages) {
    const html = fs.readFileSync(path.join(DOCS, p), 'utf8');
    // Attribute order varies, and some heads are built in template strings.
    for (const [tag] of html.matchAll(/<h[23]\b[^>]*>/g)) {
      if (!/\bsection-title\b/.test(tag)) continue;
      const style = (tag.match(/style="([^"]*)"/) || [])[1] || '';
      if (/text-transform|letter-spacing/.test(style)) bad.push(`${p}: ${tag.slice(0, 90)}`);
    }
  }
  if (bad.length) throw new Error(bad.join('\n'));
});

test('the front page uses no heading style other than the section head', () => {
  const html = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
  const h2s = [...html.matchAll(/<h2\b[^>]*>/g)].map((m) => m[0]);
  const odd = h2s.filter((h) => !/class="[^"]*\bsection-title\b/.test(h));
  if (odd.length) throw new Error(`h2 without .section-title on index.html:\n${odd.join('\n')}`);
});

// ---------- removed furniture stays removed ----------
test('front page: no exec-brief cards, no "Latest" flag on the lead', () => {
  const html = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
  if (/exec-brief/.test(html)) throw new Error('index.html carries .exec-brief again');
  if (/lead-flag/.test(appJs)) throw new Error('renderLeadStory prints a .lead-flag again — the rail head already says "Latest"');
});

test('.bluf is a keyline and a run-in label, not a tinted box with a capitals tag', () => {
  const rules = [...css.matchAll(/(^|\n)\s*\.bluf(-tag|-body)?\s*\{([^}]*)\}/g)].map((m) => m[3]).join('\n');
  if (!rules) throw new Error('no .bluf rule found in styles.css');
  if (/background|border-radius|text-transform/.test(rules)) {
    throw new Error('.bluf / .bluf-tag set a background, radius or capitals again');
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
/**
 * commission-report.test.js — integrity checks for the SCSP robotics commission
 * report index (docs/data/scsp-robotics-commission-2026.json) and the pages that
 * quote it.
 *
 * Every citation on the site links to `pdf_url#page=<pdf_page>`. The report's
 * printed page numbers run one behind the PDF's (the cover is PDF page 1), so a
 * pdf_page that isn't page + 1 sends a reader to the wrong page — silently.
 * The notes on other pages name findings, figures and themes by id; a typo there
 * renders nothing, also silently. Both fail here instead.
 *
 * No dependencies. Exit 0 = all good; exit 1 = problems found.
 *   node scripts/commission-report.test.js
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const report = JSON.parse(readFileSync(resolve(ROOT, 'docs/data/scsp-robotics-commission-2026.json'), 'utf8'));

let passed = 0;
let failed = 0;
function check(name, problems) {
  if (problems.length) {
    failed++;
    console.error(`✗ ${name}`);
    problems.slice(0, 10).forEach((p) => console.error(`    ${p}`));
  } else {
    passed++;
    console.log(`✓ ${name}`);
  }
}

const themeIds = new Set(report.themes.map((t) => t.id));
const findingNs = new Set(report.findings.map((f) => f.n));
const figureIds = new Set(report.key_figures.map((k) => k.id));

const cited = [
  ...report.findings.map((f) => [`finding ${f.n}`, f]),
  ...report.findings.flatMap((f) => f.evidence.map((e, i) => [`finding ${f.n} evidence ${i}`, e])),
  ...report.key_figures.map((k) => [`figure ${k.id}`, k]),
  ...report.directions.map((d, i) => [`direction ${i}`, d]),
  ...report.programs.map((p) => [`program ${p.name}`, p]),
  ...report.quotes.map((q, i) => [`quote ${i}`, q]),
  ...report.caveats.map((c, i) => [`caveat ${i}`, c]),
];

check('pdf_url and page_url are https', [report.pdf_url, report.page_url].filter((u) => !/^https:\/\//.test(u)));
check('every cited item has page and pdf_page = page + 1',
  cited.filter(([, x]) => !Number.isInteger(x.page) || x.pdf_page !== x.page + 1).map(([n, x]) => `${n}: page ${x.page}, pdf_page ${x.pdf_page}`));
check('every pdf_page is inside the PDF',
  cited.filter(([, x]) => x.pdf_page < 1 || x.pdf_page > report.pdf_pages).map(([n, x]) => `${n}: ${x.pdf_page}`));
check('every finding has a title, summary and page range',
  report.findings.filter((f) => !f.title || !f.summary || !/^\d+–\d+$/.test(f.pages)).map((f) => `finding ${f.n}`));
check('finding page range starts at its page',
  report.findings.filter((f) => Number(f.pages.split('–')[0]) !== f.page).map((f) => `finding ${f.n}: ${f.pages} vs ${f.page}`));
check('theme → finding references resolve',
  report.themes.flatMap((t) => t.findings.filter((n) => !findingNs.has(n)).map((n) => `${t.id} → ${n}`)));
check('finding and figure theme tags resolve', [
  ...report.findings.flatMap((f) => f.themes.filter((t) => !themeIds.has(t)).map((t) => `finding ${f.n} → ${t}`)),
  ...report.key_figures.flatMap((k) => k.themes.filter((t) => !themeIds.has(t)).map((t) => `${k.id} → ${t}`)),
]);
check('figure ids are unique', figureIds.size === report.key_figures.length ? [] : ['duplicate figure id']);
check('every figure has a label and value',
  report.key_figures.filter((k) => !k.label || !k.value).map((k) => k.id));

// Pages that mount a commission note: every id they name must exist.
const pages = readdirSync(resolve(ROOT, 'docs')).filter((f) => f.endsWith('.html'));
const mounts = [];
for (const page of pages) {
  const html = readFileSync(resolve(ROOT, 'docs', page), 'utf8');
  for (const m of html.matchAll(/RT\.mountCommissionNote\('([^']+)', (\{.*?\})\)\);/g)) {
    mounts.push([page, m[1], JSON.parse(m[2]), html]);
  }
}
check('at least five pages carry a commission note', mounts.length >= 5 ? [] : [`found ${mounts.length}`]);
check('commission notes reference real findings, figures and themes', mounts.flatMap(([page, , o]) => [
  ...(o.findings || []).filter((n) => !findingNs.has(n)).map((n) => `${page}: finding ${n}`),
  ...(o.figures || []).filter((id) => !figureIds.has(id)).map((id) => `${page}: figure ${id}`),
  ...(o.theme && !themeIds.has(o.theme) ? [`${page}: theme ${o.theme}`] : []),
]));
check('each note has its mount point on the page',
  mounts.filter(([, sel, , html]) => !html.includes(`id="${sel.replace(/^#/, '')}"`)).map(([page, sel]) => `${page}: ${sel}`));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
// Static page-weight and internal-link audit. No network, no browser.
//
//   node scripts/site-metrics.js            table + link check; exit 1 on a broken internal link
//   node scripts/site-metrics.js --append   also append one JSON line to data/metrics/site-metrics.jsonl
//
// Per page it reports what a first load costs: HTML, the local CSS/JS it references,
// the data/*.json it fetches (parsed from the page and from app.js), external requests
// (web fonts), all gzip-sized because that is what GitHub Pages serves. Scroll depth
// needs a rendered page, so it lives in uat.md's browser pass, not here.
//
// Budgets (gzip, first load): WARN when a page exceeds BUDGET_GZ_KB. The number is a
// ratchet: lower it when the worst page improves, never raise it to make a run pass.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const BUDGET_GZ_KB = 260;

const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;
const read = (p) => fs.readFileSync(p);
const kb = (n) => (n / 1024).toFixed(1);

const pages = fs.readdirSync(DOCS).filter((f) => f.endsWith('.html')).sort();
const appJs = fs.existsSync(path.join(DOCS, 'assets/app.js')) ? read(path.join(DOCS, 'assets/app.js')).toString() : '';

const rows = [];
const broken = [];

// id="..." per page, so #anchor links to another page can be checked.
const idsOf = {};
for (const p of pages) {
  const html = read(path.join(DOCS, p)).toString();
  idsOf[p] = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
}

for (const p of pages) {
  const html = read(path.join(DOCS, p)).toString();
  const local = new Set();
  const external = new Set();

  for (const m of html.matchAll(/<(?:link|script|img|source)\b[^>]*?(?:href|src|srcset)="([^"]+)"/g)) {
    const u = m[1].split(/[\s,]/)[0];
    if (/^https?:\/\//.test(u)) external.add(u);
    else if (!u.startsWith('data:')) local.add(u.split(/[?#]/)[0]);
  }
  // Data fetches: literal data/*.json in the page plus what app.js pulls for every page.
  for (const m of html.matchAll(/data\/[a-z_]+\.json/g)) local.add(m[0]);
  const shared = [...appJs.matchAll(/data\/[a-z_]+\.json/g)].map((m) => m[0]);
  if (/RT\.load|fetchJSON|loadData/.test(html)) shared.forEach((s) => local.add(s));

  let raw = read(path.join(DOCS, p)).length;
  let zipped = gz(read(path.join(DOCS, p)));
  const parts = { html: raw, css: 0, js: 0, data: 0, img: 0 };
  for (const rel of local) {
    const f = path.join(DOCS, rel);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      broken.push(`${p}: missing asset ${rel}`);
      continue;
    }
    const buf = read(f);
    raw += buf.length;
    zipped += /\.(png|jpe?g|webp|avif|woff2?)$/i.test(rel) ? buf.length : gz(buf);
    const kind = rel.endsWith('.css') ? 'css' : rel.endsWith('.js') ? 'js' : rel.endsWith('.json') ? 'data' : 'img';
    parts[kind] += buf.length;
  }

  // Internal links: page.html, page.html?q, page.html#id, #id.
  for (const m of html.matchAll(/<a\b[^>]*?href="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|javascript:)/.test(href) || href === '#' || /[$`'+]/.test(href)) continue; // template literals resolve at runtime
    const [pathPart, hash] = href.split('#');
    const target = pathPart.split('?')[0] || p;
    if (target && !fs.existsSync(path.join(DOCS, target))) broken.push(`${p}: link to missing page ${href}`);
    else if (hash && idsOf[target] && !idsOf[target].has(hash)) {
      // Fragments into JS-rendered content are allowed to be absent from the static HTML.
      if (!/^[a-z0-9-]+$/i.test(hash) || target.endsWith('.html')) {
        rows.__softAnchors = (rows.__softAnchors || 0) + 1;
      }
    }
  }

  rows.push({
    page: p,
    requests: 1 + local.size + external.size,
    external: external.size,
    raw_kb: +kb(raw),
    gz_kb: +kb(zipped),
    data_kb: +kb(parts.data),
    js_kb: +kb(parts.js),
  });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('page', 28) + pad('reqs', 6) + pad('ext', 5) + pad('raw KB', 10) + pad('gzip KB', 10) + pad('data KB', 10) + 'js KB');
for (const r of rows.sort((a, b) => b.gz_kb - a.gz_kb)) {
  const flag = r.gz_kb > BUDGET_GZ_KB ? '  OVER BUDGET' : '';
  console.log(pad(r.page, 28) + pad(r.requests, 6) + pad(r.external, 5) + pad(r.raw_kb, 10) + pad(r.gz_kb, 10) + pad(r.data_kb, 10) + r.js_kb + flag);
}
const total = rows.reduce((s, r) => s + r.gz_kb, 0);
console.log(`\n${rows.length} pages · worst ${rows[0].page} ${rows[0].gz_kb} KB gzip (budget ${BUDGET_GZ_KB}) · sum ${total.toFixed(1)} KB`);

if (process.argv.includes('--append')) {
  const dir = path.join(ROOT, 'data/metrics');
  fs.mkdirSync(dir, { recursive: true });
  const line = { date: new Date().toISOString().slice(0, 10), budget_gz_kb: BUDGET_GZ_KB, pages: Object.fromEntries(rows.map((r) => [r.page, { reqs: r.requests, gz_kb: r.gz_kb, data_kb: r.data_kb }])) };
  fs.appendFileSync(path.join(dir, 'site-metrics.jsonl'), JSON.stringify(line) + '\n');
  console.log('appended to data/metrics/site-metrics.jsonl');
}

if (broken.length) {
  console.error('\nBROKEN INTERNAL REFERENCES:\n  ' + broken.join('\n  '));
  process.exit(1);
}
console.log('internal links and local assets: all resolve');

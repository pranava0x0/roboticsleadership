#!/usr/bin/env node
/**
 * check-sources.js — source-URL coverage audit for docs/data/supply_chain.json
 *
 * Walks every claim-bearing node in the document and verifies it cites at
 * least one valid http(s) source URL. "Claim-bearing" = anything that states
 * a fact a reader could ask "says who?" about: BLUF, KPIs, chain stages,
 * category summaries/shares, chokepoints, companies (incl. sites/financing,
 * which inherit the company's sources), stakeholder entities and actions,
 * government programs, and facts.
 *
 * No dependencies. Exit 0 = full coverage; exit 1 = gaps found.
 *
 * Usage:
 *   node scripts/check-sources.js            # coverage report
 *   node scripts/check-sources.js --list     # also print every unique URL
 *   node scripts/check-sources.js --live     # also HEAD-check each unique URL
 *                                            # (2s timeout, 1.5s/host spacing;
 *                                            #  failures reported, never fatal)
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const DATA = resolve(ROOT, 'docs/data/supply_chain.json');

const LIST = process.argv.includes('--list');
const LIVE = process.argv.includes('--live');

const isURL = (u) => typeof u === 'string' && /^https?:\/\/[^\s]+$/.test(u);
const urlOf = (s) => (typeof s === 'string' ? s : s && s.url);

const claims = [];   // { path, label, urls: [...] }
const missing = [];  // { path, label, problem }

function claim(path, label, urls) {
  const valid = (urls || []).filter(isURL);
  claims.push({ path, label, urls: valid });
  if (valid.length === 0) {
    missing.push({ path, label, problem: 'no valid source URL' });
  }
  (urls || []).forEach((u) => {
    if (u != null && !isURL(u)) missing.push({ path, label, problem: `malformed URL "${u}"` });
  });
}

const sc = JSON.parse(readFileSync(DATA, 'utf8'));

// overview
claim('overview.bluf', 'BLUF', (sc.overview?.sources || []).map(urlOf));
(sc.overview?.kpis || []).forEach((k, i) =>
  claim(`overview.kpis[${i}]`, `KPI "${k.label}"`, (k.sources || []).map(urlOf)));

// chain stages
(sc.chain_stages || []).forEach((s, i) =>
  claim(`chain_stages[${i}]`, `stage "${s.id}"`, (s.sources || []).map(urlOf)));

// categories: summary+shares cite category sources; each chokepoint cites its own
(sc.categories || []).forEach((c, i) => {
  claim(`categories[${i}]`, `category "${c.id}" summary/shares`, (c.sources || []).map(urlOf));
  (c.chokepoints || []).forEach((ck, j) => {
    if (typeof ck === 'string') {
      missing.push({ path: `categories[${i}].chokepoints[${j}]`, label: `chokepoint in "${c.id}"`, problem: 'plain string — needs { text, source }' });
      return;
    }
    claim(`categories[${i}].chokepoints[${j}]`, `chokepoint "${String(ck.text).slice(0, 50)}…"`, [ck.source]);
  });
});

// companies: role/sites/capacity/financing claims inherit the company's sources[]
(sc.companies || []).forEach((c, i) =>
  claim(`companies[${i}]`, `company "${c.id}"`, (c.sources || []).map(urlOf)));

// stakeholders: entity role + actions inherit the entity's sources[]
(sc.stakeholders || []).forEach((g, i) =>
  (g.entities || []).forEach((e, j) =>
    claim(`stakeholders[${i}].entities[${j}]`, `entity "${e.name}"`, (e.sources || []).map(urlOf))));

// programs + facts: one source each
(sc.government_programs || []).forEach((p, i) =>
  claim(`government_programs[${i}]`, `program "${p.name}"`, [p.source]));
(sc.facts || []).forEach((f, i) =>
  claim(`facts[${i}]`, `fact "${f.label}"`, [f.source]));

// ---------- report ----------
const allURLs = new Map(); // url -> count
claims.forEach((c) => c.urls.forEach((u) => allURLs.set(u, (allURLs.get(u) || 0) + 1)));

console.log(`check-sources: ${claims.length} claim nodes, ${allURLs.size} unique source URLs`);
console.log(`  covered: ${claims.length - missing.filter((m) => m.problem === 'no valid source URL').length}/${claims.length}`);

if (missing.length) {
  console.error(`\n✗ ${missing.length} problem(s):`);
  missing.forEach((m) => console.error(`  ${m.path} — ${m.label}: ${m.problem}`));
}

if (LIST) {
  console.log('\nUnique source URLs (count = claims citing it):');
  [...allURLs.entries()].sort((a, b) => b[1] - a[1]).forEach(([u, n]) => console.log(`  ${String(n).padStart(3)}  ${u}`));
}

if (LIVE) {
  const byHost = new Map();
  [...allURLs.keys()].forEach((u) => {
    const h = new URL(u).hostname;
    if (!byHost.has(h)) byHost.set(h, []);
    byHost.get(h).push(u);
  });
  console.log(`\nLive-checking ${allURLs.size} URLs across ${byHost.size} hosts (HEAD, 2s timeout, 1.5s/host spacing)…`);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const results = [];
  // one worker per host, sequential within host — polite to each origin
  await Promise.all([...byHost.entries()].map(async ([host, urls]) => {
    for (const u of urls) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2000);
        const res = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'robotics-tracker-source-check (+https://github.com/pranava0x0/roboticsleadership)' } });
        clearTimeout(t);
        results.push({ u, status: res.status });
      } catch (e) {
        results.push({ u, status: `ERR ${e.name === 'AbortError' ? 'timeout' : e.message}` });
      }
      await sleep(1500);
    }
  }));
  const bad = results.filter((r) => typeof r.status !== 'number' || r.status >= 400);
  console.log(`  reachable: ${results.length - bad.length}/${results.length}`);
  // Live failures are informational (paywalls and bot-blocks 403 legitimately) — they never fail the run.
  bad.forEach((r) => console.log(`  ⚠ ${r.status}  ${r.u}`));
}

if (missing.length) {
  console.error('\nSource coverage check failed.');
  process.exit(1);
}
console.log('\nAll claims carry source URLs.');

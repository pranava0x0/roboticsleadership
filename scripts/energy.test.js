#!/usr/bin/env node
/**
 * energy.test.js — integrity checks for the embedded Robotics-for-Energy dataset.
 *
 * The energy dataset lives as JS literals inside docs/energy.html (not a JSON
 * file), so it is outside validate.js / check-sources.js. This test extracts the
 * pure-data declarations and asserts the invariants the page relies on, so that
 * a missing src, a region/status name that drifts away from an entry, a stale
 * candidate, or a broken tracked-id fails locally instead of in visual review.
 *
 * No dependencies. Exit 0 = all good; exit 1 = problems found.
 *   node scripts/energy.test.js
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = resolve(ROOT, 'docs/energy.html');
const COMPANIES = resolve(ROOT, 'docs/data/companies.json');

const html = readFileSync(HTML, 'utf8');
const companies = JSON.parse(readFileSync(COMPANIES, 'utf8'));
const companyIds = new Set(companies.map((c) => c.id));

// ---- Extract the pure-data slice (CLUSTERS … just before renderEnergy) ----
const start = html.indexOf('const CLUSTERS');
const end = html.indexOf('(function renderEnergy');
if (start < 0 || end < 0) {
  console.error('energy.test: could not locate the data block in energy.html');
  process.exit(1);
}
const slice = html.slice(start, end);
let data;
try {
  // The slice is pure literals + a pure arrow fn — no DOM references.
  data = new Function(
    `${slice}; return { CLUSTERS, SECTIONS, REGION_SHORT, REGIONS, CANDIDATES, ANNOUNCED, POTENTIAL, statusOf };`
  )();
} catch (err) {
  console.error('energy.test: failed to evaluate the data block:', err.message);
  process.exit(1);
}
const { CLUSTERS, SECTIONS, REGION_SHORT, REGIONS, CANDIDATES, ANNOUNCED, POTENTIAL, statusOf } = data;

const errors = [];
const fail = (msg) => errors.push(msg);
const isURL = (u) => typeof u === 'string' && /^https?:\/\/[^\s]+$/.test(u);

// ---- Flatten items, keyed by name ----
const items = [];
const nameToItem = new Map();
for (const id of Object.keys(SECTIONS)) {
  for (const it of SECTIONS[id].items) {
    items.push({ ...it, _section: id });
    if (nameToItem.has(it.name)) fail(`duplicate entry name "${it.name}" (names must be unique — maps are keyed by name)`);
    nameToItem.set(it.name, it);
  }
}

// ---- 1. Every entry has a valid shape + primary source ----
for (const it of items) {
  if (!it.name || typeof it.name !== 'string') fail(`entry in section "${it._section}" missing a name`);
  if (!it.desc) fail(`"${it.name}" missing desc`);
  if (!it.tag) fail(`"${it.name}" missing tag`);
  if (!Array.isArray(it.src) || it.src.length < 2) fail(`"${it.name}" src must be [label, url]`);
  else {
    if (!it.src[0]) fail(`"${it.name}" missing source label`);
    if (!isURL(it.src[1]) && !String(it.src[1]).startsWith('companies.html')) fail(`"${it.name}" source is not a URL: ${it.src[1]}`);
  }
}

// ---- 2. Region coverage (no silent "Other" fallback; short label exists) ----
for (const it of items) {
  const region = REGIONS[it.name];
  if (!region) fail(`"${it.name}" has no REGIONS entry (would render as "Other")`);
  else if (!REGION_SHORT[region]) fail(`region "${region}" (for "${it.name}") has no REGION_SHORT label`);
}

// ---- 3. Status sets reference real entries and don't overlap ----
for (const name of ANNOUNCED) if (!nameToItem.has(name)) fail(`ANNOUNCED references unknown entry "${name}"`);
for (const name of POTENTIAL) if (!nameToItem.has(name)) fail(`POTENTIAL references unknown entry "${name}"`);
for (const name of ANNOUNCED) if (POTENTIAL.has(name)) fail(`"${name}" is in both ANNOUNCED and POTENTIAL`);
for (const it of items) {
  const s = statusOf(it.name);
  if (!['deployed', 'announced', 'potential'].includes(s)) fail(`"${it.name}" resolved to invalid status "${s}"`);
}

// ---- 4. Candidates reference real, untracked entries ----
for (const name of CANDIDATES) {
  const it = nameToItem.get(name);
  if (!it) fail(`CANDIDATES references unknown entry "${name}"`);
  else if (it.tracked) fail(`candidate "${name}" is already tracked (${it.tracked}) — remove from CANDIDATES`);
}

// ---- 5. Cluster ↔ section coverage (every section in exactly one cluster) ----
const sectionIds = new Set(Object.keys(SECTIONS));
const clustered = [];
for (const cl of CLUSTERS) for (const id of cl.sections) {
  if (!sectionIds.has(id)) fail(`cluster "${cl.label}" lists unknown section "${id}"`);
  clustered.push(id);
}
for (const id of sectionIds) if (!clustered.includes(id)) fail(`section "${id}" is not in any cluster`);
clustered.forEach((id, i) => { if (clustered.indexOf(id) !== i) fail(`section "${id}" appears in more than one cluster`); });

// ---- 6. Tracked entries point at real companies.json ids ----
for (const it of items) {
  if (it.tracked && !companyIds.has(it.tracked)) fail(`"${it.name}" tracked id "${it.tracked}" not found in companies.json`);
}

// ---- Report ----
const byStatus = items.reduce((a, it) => ((a[statusOf(it.name)] = (a[statusOf(it.name)] || 0) + 1), a), {});
if (errors.length) {
  console.error(`✗ energy dataset: ${errors.length} problem(s)`);
  for (const e of errors) console.error('   • ' + e);
  process.exit(1);
}
console.log(`✓ energy dataset — ${items.length} entries, ${Object.keys(SECTIONS).length} sections, ${CLUSTERS.length} clusters`);
console.log(`  status: ${byStatus.deployed || 0} deployed · ${byStatus.announced || 0} announced · ${byStatus.potential || 0} potential`);
console.log(`  ${[...CANDIDATES].length} candidates, ${items.filter((i) => i.tracked).length} tracked cross-links — all valid`);

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
import { runInNewContext } from 'node:vm';

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

// ---- 7. Project Prime Mover — the four draft inquiry variants ----
// PM_VARIANTS is the single source of truth: button counts and the jump-nav chip
// derive from it, so the invariants that matter are structural (every question
// answerable and uniquely addressable) plus the premise of the feature itself —
// four progressively shorter drafts, each wired to a real button.
// Evaluated in an empty vm context: the slice is pure literals, and a bare
// sandbox keeps require/process/globals out of reach.
const pmStart = html.indexOf('const PM_VARIANTS');
const pmEnd = html.indexOf('(function renderPrimeMover');
let PM_VARIANTS = null;
if (pmStart < 0 || pmEnd < 0) {
  fail('could not locate the PM_VARIANTS data block in energy.html');
} else {
  try {
    PM_VARIANTS = runInNewContext(`${html.slice(pmStart, pmEnd)}; PM_VARIANTS`, Object.create(null));
  } catch (err) {
    fail(`failed to evaluate PM_VARIANTS: ${err.message}`);
  }
}

if (PM_VARIANTS) {
  const qCount = (v) => v.cats.reduce((n, c) => n + c.qs.length, 0);
  const ORDER = ['full', 'tight', 'core', 'lean'];

  for (const key of ORDER) {
    if (!PM_VARIANTS[key]) fail(`PM_VARIANTS missing the "${key}" variant`);
  }
  for (const key of Object.keys(PM_VARIANTS)) {
    if (!ORDER.includes(key)) fail(`PM_VARIANTS has unexpected variant "${key}" (no button renders it)`);
  }

  for (const [key, v] of Object.entries(PM_VARIANTS)) {
    if (!v.note) fail(`variant "${key}" missing the note shown under the buttons`);
    if (typeof v.checklist !== 'boolean') fail(`variant "${key}" checklist must be a boolean (drives [hidden])`);
    if (!Array.isArray(v.cats) || v.cats.length === 0) fail(`variant "${key}" has no categories`);

    const ids = [];
    for (const cat of v.cats || []) {
      if (!cat.letter) fail(`variant "${key}" has a category with no letter`);
      if (!cat.title) fail(`variant "${key}" category "${cat.letter}" missing title`);
      if (!cat.sub) fail(`variant "${key}" category "${cat.letter}" missing sub (roadmap chapter mapping)`);
      if (!Array.isArray(cat.qs) || cat.qs.length === 0) fail(`variant "${key}" category "${cat.letter}" has no questions`);
      for (const q of cat.qs || []) {
        if (!Array.isArray(q) || q.length !== 2) { fail(`variant "${key}" category "${cat.letter}" has a question that is not [id, text]`); continue; }
        const [qid, text] = q;
        if (!/^[A-Z][0-9]+$/.test(qid)) fail(`variant "${key}" question id "${qid}" must look like A1 / Q1 (it becomes the #pm-<id> anchor)`);
        if (!text || text.length < 20) fail(`variant "${key}" question "${qid}" has no real text`);
        ids.push(qid);
      }
    }
    ids.forEach((id, i) => {
      if (ids.indexOf(id) !== i) fail(`variant "${key}" reuses question id "${id}" (duplicate #pm-${id.toLowerCase()} anchor)`);
    });
  }

  // The premise: each draft is strictly shorter than the one before it.
  for (let i = 1; i < ORDER.length; i++) {
    const prev = PM_VARIANTS[ORDER[i - 1]], cur = PM_VARIANTS[ORDER[i]];
    if (prev && cur && qCount(cur) >= qCount(prev)) {
      fail(`variant "${ORDER[i]}" (${qCount(cur)} qs) is not shorter than "${ORDER[i - 1]}" (${qCount(prev)} qs)`);
    }
  }

  // Every variant has a button, and every button maps to a variant — a typo in
  // data-variant makes a silently dead button (apply() early-returns on !v).
  const buttonVariants = [...html.matchAll(/class="rfi-vbtn"[^>]*data-variant="([^"]+)"/g)].map((m) => m[1]);
  for (const key of Object.keys(PM_VARIANTS)) {
    if (!buttonVariants.includes(key)) fail(`variant "${key}" has no .rfi-vbtn button in energy.html`);
  }
  for (const b of buttonVariants) {
    if (!PM_VARIANTS[b]) fail(`button data-variant="${b}" does not match any PM_VARIANTS key (dead button)`);
  }
  const pressed = [...html.matchAll(/class="rfi-vbtn"[^>]*aria-pressed="true"/g)];
  if (pressed.length !== 1) fail(`exactly one .rfi-vbtn must start aria-pressed="true" (found ${pressed.length})`);
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
if (PM_VARIANTS) {
  const counts = ['full', 'tight', 'core', 'lean']
    .map((k) => `${k} ${PM_VARIANTS[k].cats.reduce((n, c) => n + c.qs.length, 0)}`)
    .join(' · ');
  console.log(`  Prime Mover drafts: ${counts} — all wired to buttons, ids unique`);
}

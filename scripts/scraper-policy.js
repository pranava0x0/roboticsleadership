#!/usr/bin/env node
/**
 * scraper-policy.js — fetch Federal Register robotics-related rules and append to policies.json.
 *
 * No dependencies. Node 18+.
 *
 * Federal Register API: free, no auth.
 *   https://www.federalregister.gov/api/v1/documents.json?conditions[term]=robotics&per_page=50
 *
 * Behavior:
 *   - Hits the Federal Register JSON API with the search terms in sources.policies[id=federal-register-policy].keywords.
 *   - Deduplicates against existing policies.json by full_text_url + bill_number combo.
 *   - For each new item, writes a stub policy with status="In effect" or "Introduced" inferred from publication_date.
 *   - Marks _requires_curator_review:true so the editor can confirm scope.
 *   - Writes back policies.json, sorted by introduced_date desc.
 *
 * Usage:
 *   node scripts/scraper-policy.js
 *   node scripts/scraper-policy.js --dry-run
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const POLICIES_FILE = resolve(ROOT, 'docs/data/policies.json');
const SOURCES_FILE = resolve(ROOT, 'docs/data/sources.json');

const UA = 'RoboticsTrackerBot/0.1 (+https://github.com/pranava0x0/roboticsleadership)';
const DRY = process.argv.includes('--dry-run');

function load(p) { return JSON.parse(readFileSync(p, 'utf8')); }
function save(p, o) { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); }
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

async function fetchTerm(term) {
  const url = `https://www.federalregister.gov/api/v1/documents.json?conditions[term]=${encodeURIComponent(term)}&per_page=50&order=newest`;
  console.log(`  → GET ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const json = await res.json();
  return Array.isArray(json.results) ? json.results : [];
}

function buildPolicy(r, existingIds) {
  const title = (r.title || '').trim();
  if (!title || !r.html_url) return null;
  const introduced = (r.publication_date || '').slice(0, 7);
  let id = slugify('fr-' + title + '-' + introduced);
  let n = 1;
  while (existingIds.has(id)) {
    id = slugify('fr-' + title + '-' + introduced) + '-' + n++;
  }
  const typeMap = {
    'Rule': 'Regulation',
    'Proposed Rule': 'Regulation',
    'Notice': 'Regulation',
    'Presidential Document': 'Executive Order',
  };
  const type = typeMap[r.type] || 'Regulation';
  const status = r.type === 'Proposed Rule' ? 'Introduced' : 'In effect';
  return {
    id,
    title,
    type,
    level: 'Federal',
    state: 'N/A',
    introduced_date: introduced,
    status,
    bill_number: r.document_number || null,
    sponsor: (r.agencies || []).map((a) => a.name).join(', ') || null,
    summary: (r.abstract || '').slice(0, 800) || `Federal Register ${r.type || 'document'}: ${title}`,
    full_text_url: r.html_url,
    robotics_scope: 'Federal Register — robotics-related',
    estimated_budget_usd: null,
    beneficiaries: [],
    agency_responsible: (r.agencies || []).map((a) => a.name),
    startup_eligible: false,
    application_url: null,
    archive_url: null,  // populated by scripts/archive-sources.js on a subsequent pass
    tags: ['federal', 'federal-register', 'auto-scraped'],
    sources: [{ url: r.html_url }],
    last_updated: new Date().toISOString().slice(0, 10),
    _scraped: true,
    _requires_curator_review: true,
  };
}

async function main() {
  const sources = load(SOURCES_FILE);
  const policies = load(POLICIES_FILE);
  const seenIds = new Set(policies.map((p) => p.id));
  const seenUrls = new Set(policies.map((p) => p.full_text_url).filter(Boolean));

  const cfg = (sources.policies || []).find((s) => s.id === 'federal-register-policy' && s.enabled);
  if (!cfg) {
    console.error('No enabled federal-register-policy source in sources.json.');
    process.exit(1);
  }
  const terms = cfg.keywords && cfg.keywords.length ? cfg.keywords : ['robotics'];

  let added = 0;
  for (const term of terms) {
    console.log(`\n[term: "${term}"]`);
    try {
      const results = await fetchTerm(term);
      console.log(`  → ${results.length} documents returned`);
      for (const r of results) {
        if (seenUrls.has(r.html_url)) continue;
        const rec = buildPolicy(r, seenIds);
        if (!rec) continue;
        seenIds.add(rec.id);
        seenUrls.add(rec.full_text_url);
        policies.push(rec);
        added += 1;
      }
    } catch (err) {
      console.error(`  ✗ ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  cfg.last_run = new Date().toISOString();
  policies.sort((a, b) => (a.introduced_date < b.introduced_date ? 1 : -1));

  console.log(`\nSummary: ${added} new policy stubs added.`);
  if (DRY) { console.log('Dry run — nothing written.'); return; }
  save(POLICIES_FILE, policies);
  save(SOURCES_FILE, sources);
  console.log(`Wrote ${POLICIES_FILE} (${policies.length} total records).`);
  console.log(`Wrote ${SOURCES_FILE} (last_run updated).`);
  console.log('\nCurator pass needed: confirm robotics_scope, refine status, add beneficiaries[] / tags[].');
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });

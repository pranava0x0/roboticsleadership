#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const DATA_DIR = resolve(ROOT, 'docs/data');

const policiesFile = resolve(DATA_DIR, 'policies.json');
const sourcesFile = resolve(DATA_DIR, 'sources.json');

async function main() {
  const sourcesData = JSON.parse(readFileSync(sourcesFile, 'utf8'));
  const policies = JSON.parse(readFileSync(policiesFile, 'utf8'));
  const existingUrls = new Set(policies.flatMap(p => (p.sources || []).map(s => typeof s === 'string' ? s : s.url)));
  
  const targetSource = sourcesData.policies.find(s => s.id === 'federal-register-policy' && s.enabled);
  if (!targetSource) {
    console.log('Federal Register policy scraper disabled or not found.');
    return;
  }

  console.log(`Fetching from ${targetSource.url}...`);
  const res = await fetch(targetSource.url);
  if (!res.ok) {
    console.error(`Failed to fetch: ${res.status}`);
    process.exit(1);
  }
  const data = await res.json();
  let added = 0;

  const today = new Date().toISOString().split('T')[0];

  for (const doc of data.results || []) {
    if (existingUrls.has(doc.html_url)) continue;

    const newPolicy = {
      id: `fedreg-${doc.document_number}`.toLowerCase(),
      title: doc.title,
      type: "Regulation",
      level: "Federal",
      state: "N/A",
      introduced_date: doc.publication_date || today,
      status: doc.type === 'Rule' ? 'In effect' : 'Introduced',
      bill_number: doc.document_number,
      sponsor: doc.agency_names ? doc.agency_names.join(', ') : 'Federal Agency',
      summary: doc.abstract || doc.title,
      full_text_url: doc.html_url,
      robotics_scope: "Federal Register publication",
      estimated_budget_usd: null,
      beneficiaries: [],
      agency_responsible: doc.agency_names || [],
      startup_eligible: false,
      application_url: null,
      tags: ["federal-register", "federal"],
      themes: [],
      sources: [{ url: doc.html_url }],
      last_updated: today
    };

    policies.push(newPolicy);
    existingUrls.add(doc.html_url);
    added++;
  }

  if (added > 0) {
    writeFileSync(policiesFile, JSON.stringify(policies, null, 2));
    console.log(`Added ${added} new policies.`);
  } else {
    console.log('No new policies found.');
  }

  targetSource.last_run = today;
  sourcesData._meta.last_updated = today;
  writeFileSync(sourcesFile, JSON.stringify(sourcesData, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

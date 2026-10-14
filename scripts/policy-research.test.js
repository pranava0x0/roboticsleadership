#!/usr/bin/env node
// Compare published records and quotation claims against the saved source archive.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const archive = resolve(root, 'data/research/policy-2026-10-14');
const read = (file) => JSON.parse(readFileSync(resolve(archive, file), 'utf8'));
const index = read('index.json');
const manifest = read('manifest.json');
const quotes = read('final-quote-checks.json');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const versioned = new Set(manifest.files.filter(f => f.versioned).map(f => f.path));
for (const file of manifest.files.filter(f => f.versioned)) {
  const bytes = readFileSync(resolve(archive, file.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `source hash: ${file.path}`);
}
for (const item of index.items) {
  assert(item.source_urls.length && item.source_urls.every(u => u.startsWith('https://')), item.id);
  assert(item.sections.length, `no destination: ${item.id}`);
  assert(item.local_files.some(f => f.endsWith('.txt') && versioned.has(f)), `no readable archive: ${item.id}`);
  for (const file of item.local_files.filter(f => versioned.has(f))) assert(existsSync(resolve(archive, file)), file);
}
for (const check of quotes.checks) {
  assert(check.verified, `unverified quotation: ${check.item}`);
  assert(check.files.some(file => versioned.has(file) && normalize(readFileSync(resolve(archive, file), 'utf8')).includes(normalize(check.quote))), `quotation absent from archived text: ${check.item}`);
}
const policies = JSON.parse(readFileSync(resolve(root, 'docs/data/policies.json'), 'utf8'));
for (const item of index.items.filter(x => x.latest_actions)) {
  const destination = item.sections.find(s => s.startsWith('policies.html?focus='));
  const policy = policies.find(p => p.id === destination.split('=')[1]);
  assert(policy, destination);
  assert(item.source_urls.some(u => policy.sources.some(s => (s.url || s) === u)), `published source drift: ${item.id}`);
  assert.equal(policy.last_updated, index.captured_at);
  assert(item.latest_actions.every(a => a.date <= index.captured_at), `future action: ${item.id}`);
}
assert.equal(policies.find(p => p.id === 'hr-7334-national-commission-robotics').estimated_budget_usd, null);
assert(!policies.find(p => p.id === 'hr-8189-american-security-robotics').summary.includes('covered-entity list'));
const hearings = index.items.filter(x => x.id.startsWith('hearing-'));
assert.equal(hearings.length, 4);
for (const hearing of hearings) {
  const page = readFileSync(resolve(root, 'docs/policies.html'), 'utf8');
  assert(page.includes(`id="${hearing.id}"`), `unmounted hearing: ${hearing.id}`);
  assert(page.includes(hearing.source_urls[0].replaceAll('&', '&amp;')), `hearing source absent: ${hearing.id}`);
}
assert(index.items.find(x => x.id === 'hearing-2026-03-17').documents.some(d => d.kind === 'published_transcript'));
assert(index.items.find(x => x.id === 'hearing-2026-07-22').documents.some(d => d.kind === 'unedited_transcript'));
for (const date of ['2026-04-21', '2026-06-30']) assert(index.items.find(x => x.id === `hearing-${date}`).transcript_availability.includes('No transcript entry'));
console.log(`✓ policy research: ${index.items.length} items, ${quotes.checks.length} source-verified quotes, 4 mounted hearings`);

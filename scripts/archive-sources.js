#!/usr/bin/env node
/**
 * scripts/archive-sources.js — for every source URL in the dataset,
 * look up the nearest Wayback Machine snapshot and store it alongside
 * the original URL so the citation survives if the source goes 404.
 *
 * No dependencies. Node 18+.
 *
 * What gets archived
 * ------------------
 *   news[].source_url                  → news[].archive_url
 *   companies[].funding_rounds[].url   → .archive_url
 *   companies[].deployments[].source_url → .archive_url
 *   companies[].sources[]              (string[] migrated to {url, archive_url}[])
 *   policies[].full_text_url           → .archive_url
 *   policies[].application_url         → .archive_url_application
 *   policies[].sources[]               (migrated to {url, archive_url}[])
 *   themes[].key_metrics[].source_url  → .archive_url
 *   themes[].narrative_sources[].url   → .archive_url
 *
 * Re-running is safe: any URL with an existing archive_url is skipped.
 *
 * Behavior
 * --------
 * - Default: only use the Wayback availability API. Fast, polite.
 * - --save-missing: when no snapshot exists, trigger a Save Page Now
 *   (SPN) fetch and re-check availability after a short wait. SPN is
 *   slower (~5–15s per page) so this should be used sparingly.
 *
 * Usage:
 *   node scripts/archive-sources.js                    # availability-only, all files
 *   node scripts/archive-sources.js --save-missing     # also trigger SPN for misses
 *   node scripts/archive-sources.js --file=news        # one file only
 *   node scripts/archive-sources.js --dry-run          # show what'd change, don't write
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const DATA_DIR = resolve(ROOT, 'docs/data');
const UA = 'RoboticsTrackerBot/0.1 (+https://github.com/pranava0x0/roboticsleadership)';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const SAVE_MISSING = args.includes('--save-missing');
const onlyFile = (args.find((a) => a.startsWith('--file=')) || '').split('=')[1];

const AVAILABILITY_DELAY_MS = 800;   // pause between availability API hits
const SPN_DELAY_MS = 6000;           // SPN page is slower; pause after each SPN trigger

function loadJSON(name) {
  return JSON.parse(readFileSync(resolve(DATA_DIR, name + '.json'), 'utf8'));
}
function saveJSON(name, obj) {
  writeFileSync(resolve(DATA_DIR, name + '.json'), JSON.stringify(obj, null, 2) + '\n');
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getArchive(url) {
  try {
    const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
    const res = await fetch(apiUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const closest = data?.archived_snapshots?.closest;
    if (closest && closest.available && closest.url) {
      // Normalize to https://web.archive.org (avoid http)
      return closest.url.replace(/^http:\/\/web\.archive\.org/, 'https://web.archive.org');
    }
    return null;
  } catch (err) {
    console.warn(`    ! availability check failed: ${err.message}`);
    return null;
  }
}

async function triggerSave(url) {
  try {
    const saveUrl = `https://web.archive.org/save/${url}`;
    // GET (no auth) triggers an async save. We don't wait for completion.
    const res = await fetch(saveUrl, { headers: { 'User-Agent': UA }, redirect: 'manual' });
    return res.ok || res.status === 302 || res.status === 303;
  } catch (err) {
    console.warn(`    ! SPN failed: ${err.message}`);
    return false;
  }
}

async function processURL(url, cache) {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url);
  console.log(`  • ${url}`);
  let archive = await getArchive(url);
  await sleep(AVAILABILITY_DELAY_MS);
  if (archive) {
    console.log(`    ✓ ${snapDate(archive)}`);
  } else if (SAVE_MISSING) {
    console.log(`    no snapshot — triggering SPN`);
    await triggerSave(url);
    await sleep(SPN_DELAY_MS);
    archive = await getArchive(url);
    if (archive) console.log(`    ✓ ${snapDate(archive)} (after SPN)`);
    else console.log(`    still no snapshot — try again later`);
  } else {
    console.log(`    (no snapshot; rerun with --save-missing to trigger)`);
  }
  cache.set(url, archive);
  return archive;
}

function snapDate(archiveUrl) {
  const m = archiveUrl.match(/\/web\/(\d{4})(\d{2})(\d{2})\d+\//);
  return m ? `snap ${m[1]}-${m[2]}-${m[3]}` : 'snap';
}

// ----------------- file processors -----------------

async function processNews(news, cache) {
  let changes = 0;
  for (const rec of news) {
    if (!rec.source_url || rec.archive_url) continue;
    const a = await processURL(rec.source_url, cache);
    if (a) { rec.archive_url = a; changes++; }
  }
  return changes;
}

async function processCompanies(companies, cache) {
  let changes = 0;
  for (const c of companies) {
    for (const r of (c.funding_rounds || [])) {
      if (!r.url || r.archive_url) continue;
      const a = await processURL(r.url, cache);
      if (a) { r.archive_url = a; changes++; }
    }
    for (const d of (c.deployments || [])) {
      if (!d.source_url || d.archive_url) continue;
      const a = await processURL(d.source_url, cache);
      if (a) { d.archive_url = a; changes++; }
    }
    if (Array.isArray(c.sources)) {
      const migrated = [];
      for (const entry of c.sources) {
        if (typeof entry === 'string') {
          const a = await processURL(entry, cache);
          migrated.push(a ? { url: entry, archive_url: a } : { url: entry });
          if (a) changes++;
        } else if (entry && typeof entry === 'object' && entry.url) {
          if (!entry.archive_url) {
            const a = await processURL(entry.url, cache);
            if (a) { entry.archive_url = a; changes++; }
          }
          migrated.push(entry);
        } else {
          migrated.push(entry);
        }
      }
      c.sources = migrated;
    }
  }
  return changes;
}

async function processPolicies(policies, cache) {
  let changes = 0;
  for (const p of policies) {
    if (p.full_text_url && !p.archive_url) {
      const a = await processURL(p.full_text_url, cache);
      if (a) { p.archive_url = a; changes++; }
    }
    if (p.application_url && !p.archive_url_application) {
      const a = await processURL(p.application_url, cache);
      if (a) { p.archive_url_application = a; changes++; }
    }
    if (Array.isArray(p.sources)) {
      const migrated = [];
      for (const entry of p.sources) {
        if (typeof entry === 'string') {
          const a = await processURL(entry, cache);
          migrated.push(a ? { url: entry, archive_url: a } : { url: entry });
          if (a) changes++;
        } else if (entry && typeof entry === 'object' && entry.url) {
          if (!entry.archive_url) {
            const a = await processURL(entry.url, cache);
            if (a) { entry.archive_url = a; changes++; }
          }
          migrated.push(entry);
        } else {
          migrated.push(entry);
        }
      }
      p.sources = migrated;
    }
  }
  return changes;
}

async function processThemes(themes, cache) {
  let changes = 0;
  for (const t of themes) {
    for (const m of (t.key_metrics || [])) {
      if (!m.source_url || m.archive_url) continue;
      const a = await processURL(m.source_url, cache);
      if (a) { m.archive_url = a; changes++; }
    }
    for (const s of (t.narrative_sources || [])) {
      if (!s.url || s.archive_url) continue;
      const a = await processURL(s.url, cache);
      if (a) { s.archive_url = a; changes++; }
    }
  }
  return changes;
}

// ----------------- main -----------------

async function main() {
  const cache = new Map();
  const targets = onlyFile ? [onlyFile] : ['companies', 'policies', 'news', 'themes'];
  console.log(`Archiving for: ${targets.join(', ')}`);
  console.log(`Save missing: ${SAVE_MISSING ? 'yes' : 'no'}`);
  if (DRY) console.log('(dry run — nothing will be written)');

  let total = 0;
  for (const name of targets) {
    console.log(`\n[${name}]`);
    const data = loadJSON(name);
    let changes = 0;
    if (name === 'news') changes = await processNews(data, cache);
    else if (name === 'companies') changes = await processCompanies(data, cache);
    else if (name === 'policies') changes = await processPolicies(data, cache);
    else if (name === 'themes') changes = await processThemes(data, cache);
    console.log(`  → ${changes} archive URL(s) added`);
    total += changes;
    if (!DRY && changes > 0) saveJSON(name, data);
  }
  console.log(`\nTotal: ${total} archive URL(s) added across ${targets.length} file(s).`);
  if (!DRY && total > 0) console.log(`Re-run scripts/validate.js to confirm shape.`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });

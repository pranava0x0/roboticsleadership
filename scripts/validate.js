#!/usr/bin/env node
/**
 * validate.js — schema check across docs/data/*.json
 *
 * No dependencies. Run with Node 18+.
 *
 * Usage:
 *   node scripts/validate.js                # check all
 *   node scripts/validate.js companies      # check one file
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const DATA_DIR = resolve(ROOT, 'docs/data');

const SCHEMAS = {
  companies: {
    required: ['id', 'name', 'founded', 'hq', 'website', 'funding_rounds', 'tags', 'data_confidence', 'sources', 'last_updated', 'themes'],
    types: {
      id: 'string',
      name: 'string',
      funding_rounds: 'array',
      deployments: 'array',
      tags: 'array',
      sources: 'array',
      themes: 'array',
      financials: 'object',
    },
    custom: (rec, addError) => {
      if (rec.data_confidence && !['high', 'medium', 'low'].includes(rec.data_confidence)) {
        addError(`data_confidence "${rec.data_confidence}" not in {high, medium, low}`);
      }
      if (!Array.isArray(rec.sources) || rec.sources.length === 0) {
        addError('record has no sources[] — every record must cite at least one primary source');
      }
      // sources[] entries may be a string (legacy) or { url, archive_url? } (current)
      (rec.sources || []).forEach((s, i) => {
        if (typeof s === 'string') return;
        if (s && typeof s === 'object' && typeof s.url === 'string') return;
        addError(`sources[${i}] must be a URL string or { url, archive_url? } object`);
      });
      (rec.funding_rounds || []).forEach((r, i) => {
        if (!r.date) addError(`funding_rounds[${i}] missing date`);
        if (!r.round) addError(`funding_rounds[${i}] missing round name`);
        if (r.confidence && !['confirmed', 'reported', 'rumored'].includes(r.confidence)) {
          addError(`funding_rounds[${i}].confidence "${r.confidence}" not in {confirmed, reported, rumored}`);
        }
      });
    },
  },
  policies: {
    required: ['id', 'title', 'type', 'level', 'introduced_date', 'status', 'summary', 'robotics_scope', 'sources', 'last_updated', 'themes'],
    types: {
      themes: 'array'
    },
    custom: (rec, addError) => {
      const validStatuses = ['Introduced', 'Committee', 'Passed House', 'Passed Senate', 'Signed', 'In effect', 'Expired', 'Active', 'In development', 'Draft'];
      if (!validStatuses.includes(rec.status)) {
        addError(`status "${rec.status}" not in canonical set`);
      }
      const validTypes = ['Bill', 'Executive Order', 'Regulation', 'Incentive Program', 'Procurement', 'Initiative', 'Standard'];
      if (!validTypes.includes(rec.type)) {
        addError(`type "${rec.type}" not in canonical set`);
      }
      const validLevels = ['Federal', 'State', 'City'];
      if (!validLevels.includes(rec.level)) {
        addError(`level "${rec.level}" not in canonical set`);
      }
      if (!Array.isArray(rec.sources) || rec.sources.length === 0) {
        addError('record has no sources[]');
      }
      (rec.sources || []).forEach((s, i) => {
        if (typeof s === 'string') return;
        if (s && typeof s === 'object' && typeof s.url === 'string') return;
        addError(`sources[${i}] must be a URL string or { url, archive_url? } object`);
      });
    },
  },
  news: {
    required: ['id', 'title', 'date', 'source', 'source_url', 'summary', 'category', 'sentiment', 'confidence'],
    custom: (rec, addError) => {
      const validCategories = ['Funding', 'Deployment', 'Policy', 'Competitive', 'Supply Chain', 'Geopolitics', 'Research'];
      if (!validCategories.includes(rec.category)) {
        addError(`category "${rec.category}" not in canonical set`);
      }
      if (!['Positive', 'Neutral', 'Negative', 'Mixed'].includes(rec.sentiment)) {
        addError(`sentiment "${rec.sentiment}" not in {Positive, Neutral, Negative, Mixed}`);
      }
      if (!['High', 'Medium', 'Low'].includes(rec.confidence)) {
        addError(`confidence "${rec.confidence}" not in {High, Medium, Low}`);
      }
      if (!rec.source_url || !/^https?:\/\//.test(rec.source_url)) {
        addError(`source_url is missing or not a URL: "${rec.source_url}"`);
      }
    },
  },
  themes: {
    required: ['id', 'name', 'narrative', 'direction', 'last_updated'],
    custom: (rec, addError) => {
      if (!['Accelerating', 'Stable', 'Slowing'].includes(rec.direction)) {
        addError(`direction "${rec.direction}" not in {Accelerating, Stable, Slowing}`);
      }
    },
  },
  agencies: {
    required: ['id', 'name', 'full_name', 'parent', 'url', 'show_in_rd_table', 'notes'],
    types: {
      id: 'string',
      name: 'string',
      full_name: 'string',
      parent: 'string',
      url: 'string',
      show_in_rd_table: 'boolean',
      notes: 'array'
    },
    custom: (rec, addError) => {
      if (rec.programs !== undefined) {
        addError('programs field is deprecated; convert programs to first-class policies in policies.json and use notes instead');
      }
      if (rec.show_in_rd_table === true) {
        const condFields = ['rd_focus', 'applications', 'manufacturing'];
        condFields.forEach(f => {
          if (rec[f] == null || rec[f] === '') {
            addError(`missing field "${f}" required when show_in_rd_table is true`);
          }
        });
      }
      if (rec.notes) {
        rec.notes.forEach((note, idx) => {
          if (typeof note !== 'string') {
            addError(`notes[${idx}] must be a string`);
          }
        });
      }
    }
  },
};

function checkRecord(rec, schema, recIdx) {
  const errs = [];
  const add = (msg) => errs.push(msg);
  (schema.required || []).forEach((f) => {
    if (rec[f] == null || rec[f] === '') add(`missing required field "${f}"`);
  });
  Object.entries(schema.types || {}).forEach(([f, t]) => {
    if (rec[f] == null) return;
    if (t === 'array' && !Array.isArray(rec[f])) add(`field "${f}" should be an array`);
    else if (t !== 'array' && typeof rec[f] !== t) add(`field "${f}" should be a ${t}, got ${typeof rec[f]}`);
  });
  if (schema.custom) schema.custom(rec, add);
  return errs;
}

function validateFile(name) {
  const filename = resolve(DATA_DIR, `${name}.json`);
  if (!existsSync(filename)) {
    return { name, ok: false, errors: [`File not found: ${filename}`], records: 0 };
  }
  let data;
  try {
    data = JSON.parse(readFileSync(filename, 'utf8'));
  } catch (err) {
    return { name, ok: false, errors: [`JSON parse failed: ${err.message}`], records: 0 };
  }
  // sources.json is config, no per-record schema
  if (name === 'sources') {
    const keys = Object.keys(data).filter((k) => k !== '_meta');
    return { name, ok: keys.length > 0, errors: keys.length === 0 ? ['sources.json has no scraper-type keys'] : [], records: keys.length };
  }
  if (!Array.isArray(data)) {
    return { name, ok: false, errors: ['Top-level JSON should be an array of records'], records: 0 };
  }
  const schema = SCHEMAS[name];
  if (!schema) {
    return { name, ok: true, errors: [`(no schema defined for "${name}" — skipping content check)`], records: data.length };
  }
  const errors = [];
  const ids = new Set();
  data.forEach((rec, i) => {
    if (!rec.id) {
      errors.push(`#${i} missing id`);
    } else if (ids.has(rec.id)) {
      errors.push(`#${i} duplicate id "${rec.id}"`);
    } else {
      ids.add(rec.id);
    }
    const recErrors = checkRecord(rec, schema, i);
    recErrors.forEach((e) => errors.push(`#${i} (${rec.id || '?'}): ${e}`));
  });
  return { name, ok: errors.length === 0, errors, records: data.length };
}

function checkCrossRefs() {
  // Catches drift where a news / theme record points to a deleted company / policy / news id.
  const errs = [];
  let companies, policies, news, themes, agencies;
  try {
    companies = JSON.parse(readFileSync(resolve(DATA_DIR, 'companies.json'), 'utf8'));
    policies  = JSON.parse(readFileSync(resolve(DATA_DIR, 'policies.json'),  'utf8'));
    news      = JSON.parse(readFileSync(resolve(DATA_DIR, 'news.json'),      'utf8'));
    themes    = JSON.parse(readFileSync(resolve(DATA_DIR, 'themes.json'),    'utf8'));
    agencies  = JSON.parse(readFileSync(resolve(DATA_DIR, 'agencies.json'),  'utf8'));
  } catch (e) {
    return [`Could not load all five data files for cross-ref check: ${e.message}`];
  }
  const C = new Set(companies.map((c) => c.id));
  const P = new Set(policies.map((p) => p.id));
  const N = new Set(news.map((n) => n.id));
  const T = new Set(themes.map((t) => t.id));
  const A = new Set(agencies.map((a) => a.id));

  const check = (rec, kind, field, refSet) =>
    (rec[field] || []).forEach((id) => {
      if (!refSet.has(id)) errs.push(`${kind} "${rec.id}" → unknown ${field.replace(/^related_/, '')} id "${id}"`);
    });
  news.forEach((n) => {
    check(n, 'news', 'companies', C);
    check(n, 'news', 'policies', P);
    check(n, 'news', 'themes', T);
  });
  companies.forEach((c) => {
    check(c, 'company', 'themes', T);
  });
  policies.forEach((p) => {
    check(p, 'policy', 'themes', T);
    if (p.agency_responsible) {
      if (!Array.isArray(p.agency_responsible)) {
        errs.push(`policy "${p.id}" → agency_responsible should be an array`);
      } else {
        p.agency_responsible.forEach((id) => {
          if (!A.has(id)) errs.push(`policy "${p.id}" → unknown agency id "${id}"`);
        });
      }
    }
  });
  return errs;
}

function main() {
  const requested = process.argv[2];
  const files = requested
    ? [requested]
    : ['companies', 'policies', 'news', 'themes', 'sources', 'agencies'];

  let allOk = true;
  for (const name of files) {
    const r = validateFile(name);
    const status = r.ok ? '✓' : '✗';
    console.log(`${status} ${name.padEnd(12)} ${String(r.records).padStart(4)} records`);
    if (!r.ok) allOk = false;
    r.errors.slice(0, 15).forEach((e) => console.log(`   ${e}`));
    if (r.errors.length > 15) console.log(`   …and ${r.errors.length - 15} more`);
  }

  // Cross-ref check only when running the full sweep (not per-file)
  if (!requested) {
    const xerrs = checkCrossRefs();
    const status = xerrs.length === 0 ? '✓' : '✗';
    console.log(`${status} cross-refs   ${String(xerrs.length).padStart(4)} broken`);
    xerrs.slice(0, 15).forEach((e) => console.log(`   ${e}`));
    if (xerrs.length > 15) console.log(`   …and ${xerrs.length - 15} more`);
    if (xerrs.length) allOk = false;
  }

  if (!allOk) {
    console.error('\nValidation failed.');
    process.exit(1);
  }
  console.log('\nAll files valid.');
}

main();

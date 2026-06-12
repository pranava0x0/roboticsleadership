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
    required: ['id', 'name', 'founded', 'hq', 'website', 'funding_rounds', 'tags', 'data_confidence', 'sources', 'last_updated', 'themes', 'map_category'],
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
      // Canonical market-map segments. Mirrored by SEGMENTS in docs/companies.html —
      // the frontend builds its dropdown/map from record values, so a new id here
      // shows up there automatically; only the display label needs adding.
      const validSegments = ['humanoid', 'brains', 'industrial', 'defense', 'field', 'service', 'enablers'];
      if (rec.map_category && !validSegments.includes(rec.map_category)) {
        addError(`map_category "${rec.map_category}" not in canonical set {${validSegments.join(', ')}}`);
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
  state_policy: {
    required: ['id', 'title', 'summary', 'direction', 'sources'],
    types: {
      key_points: 'array',
      example_states: 'array',
      sources: 'array',
    },
    custom: (rec, addError) => {
      if (!['Accelerating', 'Stable', 'Slowing'].includes(rec.direction)) {
        addError(`direction "${rec.direction}" not in {Accelerating, Stable, Slowing}`);
      }
      if (!Array.isArray(rec.sources) || rec.sources.length === 0) {
        addError('record has no sources[] — every state-policy theme must cite at least one source');
      }
      (rec.sources || []).forEach((s, i) => {
        if (s && typeof s === 'object' && typeof s.url === 'string') return;
        addError(`sources[${i}] must be a { url, label? } object`);
      });
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

// supply_chain.json — structured document: _meta + overview + chain_stages +
// categories + companies + stakeholders + government_programs + facts.
// Every category/company/entity must cite at least one source URL.
function validateSupplyChain(name, data) {
  const errors = [];
  const add = (m) => errors.push(m);
  const isURL = (u) => typeof u === 'string' && /^https?:\/\//.test(u);
  const checkSources = (rec, label) => {
    if (!Array.isArray(rec.sources) || rec.sources.length === 0) {
      add(`${label}: no sources[] — every record must cite at least one source`);
      return;
    }
    rec.sources.forEach((s, i) => {
      const url = typeof s === 'string' ? s : s && s.url;
      if (!isURL(url)) add(`${label}: sources[${i}] is not a URL`);
    });
  };

  if (!data._meta || !data._meta.last_updated) add('_meta.last_updated missing');
  if (!data.overview || !data.overview.bluf) add('overview.bluf missing');
  checkSources(data.overview || {}, 'overview (BLUF)');
  if (!Array.isArray(data.overview?.kpis) || data.overview.kpis.length === 0) add('overview.kpis missing or empty');
  (data.overview?.kpis || []).forEach((k, i) => {
    if (!k.label || !k.value) add(`overview.kpis[${i}] needs label + value`);
    checkSources(k, `overview.kpis[${i}] (${k.label || '?'})`);
  });

  const VALID_POSITIONS = ['strong', 'contested', 'weak'];
  if (!Array.isArray(data.chain_stages) || data.chain_stages.length === 0) add('chain_stages missing or empty');
  const stageIds = new Set();
  (data.chain_stages || []).forEach((s, i) => {
    ['id', 'name', 'us_position', 'note'].forEach((f) => { if (!s[f]) add(`chain_stages[${i}] missing "${f}"`); });
    if (s.us_position && !VALID_POSITIONS.includes(s.us_position)) {
      add(`chain_stages[${i}].us_position "${s.us_position}" not in {strong, contested, weak}`);
    }
    checkSources(s, `chain_stages[${i}] (${s.id || '?'})`);
    if (s.id) stageIds.add(s.id);
  });

  if (!Array.isArray(data.categories) || data.categories.length === 0) add('categories missing or empty');
  const catIds = new Set();
  (data.categories || []).forEach((c, i) => {
    const label = `categories[${i}] (${c.id || '?'})`;
    ['id', 'name', 'stage', 'summary'].forEach((f) => { if (!c[f]) add(`${label} missing "${f}"`); });
    if (c.id) {
      if (catIds.has(c.id)) add(`${label}: duplicate id`);
      catIds.add(c.id);
    }
    if (c.stage && stageIds.size && !stageIds.has(c.stage)) add(`${label}: unknown stage "${c.stage}"`);
    ['us_share_pct', 'china_share_pct', 'row_share_pct'].forEach((f) => {
      if (c[f] != null && (typeof c[f] !== 'number' || c[f] < 0 || c[f] > 100)) {
        add(`${label}: ${f} must be a number 0–100 or null`);
      }
    });
    if (!Array.isArray(c.chokepoints)) add(`${label}: chokepoints must be an array`);
    (c.chokepoints || []).forEach((ck, j) => {
      if (!ck || typeof ck !== 'object' || !ck.text) add(`${label}: chokepoints[${j}] must be { text, source }`);
      else if (!isURL(ck.source)) add(`${label}: chokepoints[${j}] source must be a URL`);
    });
    checkSources(c, label);
  });

  if (!Array.isArray(data.companies) || data.companies.length === 0) add('companies missing or empty');
  const coIds = new Set();
  (data.companies || []).forEach((c, i) => {
    const label = `companies[${i}] (${c.id || '?'})`;
    ['id', 'name', 'country', 'role'].forEach((f) => { if (!c[f]) add(`${label} missing "${f}"`); });
    if (c.id) {
      if (coIds.has(c.id)) add(`${label}: duplicate id`);
      coIds.add(c.id);
    }
    if (!Array.isArray(c.categories) || c.categories.length === 0) {
      add(`${label}: categories[] missing — every company maps to ≥1 category`);
    } else if (catIds.size) {
      c.categories.forEach((id) => { if (!catIds.has(id)) add(`${label}: unknown category "${id}"`); });
    }
    (c.sites || []).forEach((s, j) => {
      if (!s.location) add(`${label}: sites[${j}] missing location`);
    });
    (c.financing || []).forEach((f, j) => {
      if (!f.date) add(`${label}: financing[${j}] missing date`);
      if (!f.detail) add(`${label}: financing[${j}] missing detail`);
      if (f.amount_usd != null && typeof f.amount_usd !== 'number') add(`${label}: financing[${j}].amount_usd must be a number or null`);
    });
    checkSources(c, label);
  });

  if (!Array.isArray(data.stakeholders) || data.stakeholders.length === 0) add('stakeholders missing or empty');
  (data.stakeholders || []).forEach((g, i) => {
    if (!g.group) add(`stakeholders[${i}] missing group name`);
    if (!Array.isArray(g.entities) || g.entities.length === 0) add(`stakeholders[${i}] (${g.group || '?'}) has no entities`);
    (g.entities || []).forEach((e, j) => {
      const label = `stakeholders[${i}].entities[${j}] (${e.name || '?'})`;
      ['name', 'type', 'role'].forEach((f) => { if (!e[f]) add(`${label} missing "${f}"`); });
      (e.actions || []).forEach((a, k) => {
        if (!a.detail) add(`${label}: actions[${k}] missing detail`);
      });
      checkSources(e, label);
    });
  });

  (data.government_programs || []).forEach((p, i) => {
    if (!p.name || !p.agency) add(`government_programs[${i}] needs name + agency`);
    if (!isURL(p.source)) add(`government_programs[${i}] (${p.name || '?'}): source must be a URL`);
  });
  (data.facts || []).forEach((f, i) => {
    if (!f.label || !f.value) add(`facts[${i}] needs label + value`);
    if (!isURL(f.source)) add(`facts[${i}] (${f.label || '?'}): source must be a URL`);
  });

  const records = (data.categories?.length || 0) + (data.companies?.length || 0) +
    (data.stakeholders || []).reduce((n, g) => n + (g.entities?.length || 0), 0);
  return { name, ok: errors.length === 0, errors, records };
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
  // supply_chain.json is a structured document (object with sections), not a record array
  if (name === 'supply_chain') {
    return validateSupplyChain(name, data);
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
    : ['companies', 'policies', 'news', 'themes', 'sources', 'agencies', 'state_policy', 'supply_chain'];

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

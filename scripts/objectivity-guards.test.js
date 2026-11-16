#!/usr/bin/env node
/**
 * objectivity-guards.test.js — fails when shipped docs/ content carries personal
 * data, working notes, AI-tool credits or curation process chatter (2026-11-15
 * objectivity audit). Text-level checks on the files GitHub Pages serves.
 *
 * Scope of the first-person check: site-authored text only. Scraped records
 * (news ids starting rss- / hn- / fedreg-) carry publisher text verbatim, and
 * quote fields carry a source's own words, so both are exempt from it. Every
 * other check runs on everything shipped.
 *
 * Usage: node scripts/objectivity-guards.test.js
 *        node scripts/objectivity-guards.test.js --root <dir>   (scan another tree)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootArg = process.argv.indexOf('--root');
const DOCS = rootArg > -1 ? resolve(process.argv[rootArg + 1]) : resolve(REPO, 'docs');

// Derived and gitignored (render-static.js writes it); not source.
const SKIP = new Set(['data/news-recent.json']);
const EXTS = new Set(['.html', '.js', '.css', '.json', '.txt', '.xml']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return EXTS.has(extname(name)) ? [p] : [];
  });
}

const files = walk(DOCS)
  .map((p) => ({ path: p, rel: relative(DOCS, p).split('\\').join('/') }))
  .filter((f) => !SKIP.has(f.rel));

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
const HOME_PATH = /(?:^|[\s"'`(=:])\/(?:Users|home)\/[^\s"'`)]/;
const FIRST_PERSON = /\bmy (?:read|notes?|searches|view)\b|\bI (?:found|think|couldn't|could not|decided)\b|\bnote to self\b|\bowner call\b/i;
const AI_CREDIT = new RegExp([
  String.raw`\b(?:Claude|Codex)\b[^.<\n]{0,60}\b(?:agents?|wrote|written|edited|gathered|checked|drafted)\b`,
  String.raw`\b(?:written|edited|gathered|checked|drafted|generated)\b (?:with|by) (?:Claude|Codex|ChatGPT|Gemini|Copilot)\b`,
  String.raw`\b(?:Haiku|Sonnet|Opus) agents?\b`,
  String.raw`\b(?:done|made|built|researched|produced|created|compiled) (?:with|by|using) (?:Claude|Codex|ChatGPT|Gemini|Copilot)\b`,
  String.raw`\bClaude Code\b`,
  String.raw`\bwith AI assistance\b`,
  String.raw`Generated with`,
  String.raw`Co-Authored-By`,
].join('|'), 'i');
const CHATTER = /as a backfill|was not read\b|confirmed-curator workflow|was not opened|not fetched/i;

// Keys whose values are a source's own words, not the site's.
const QUOTE_KEY = /(?:^|_)quote(?:_|$)|^quotes?$|_zh$|^report_heading$/;
const SCRAPED_ID = /^(?:rss|hn|fedreg)-/;

/** Yield [location, text] for every site-authored string in a JSON value. */
function* authoredStrings(value, where, key = '') {
  if (typeof value === 'string') {
    if (!QUOTE_KEY.test(key)) yield [where, value];
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* authoredStrings(value[i], `${where}[${i}]`, key);
    return;
  }
  if (value && typeof value === 'object') {
    if (typeof value.id === 'string' && SCRAPED_ID.test(value.id)) return;
    for (const [k, v] of Object.entries(value)) yield* authoredStrings(v, `${where}.${k}`, k);
  }
}

const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

function scanText(rel, text, re) {
  const hits = [];
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  for (const m of text.matchAll(g)) hits.push(`${rel}:${lineOf(text, m.index)}: ${JSON.stringify(m[0])}`);
  return hits;
}

let passed = 0;
let failed = 0;
function check(name, hits) {
  if (hits.length === 0) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}\n    ${hits.slice(0, 12).join('\n    ')}${hits.length > 12 ? `\n    …and ${hits.length - 12} more` : ''}`);
  }
}

const texts = files.map((f) => ({ ...f, text: readFileSync(f.path, 'utf8') }));
const everywhere = (re) => texts.flatMap((f) => scanText(f.rel, f.text, re));

console.log(`objectivity guards (${texts.length} shipped files under ${relative(REPO, DOCS) || DOCS})`);

check('no email addresses', everywhere(EMAIL));
check('no /Users/ or /home/ paths', everywhere(HOME_PATH));
check('no AI-tool credits', everywhere(AI_CREDIT));
check('no curation process chatter', everywhere(CHATTER));
check('no first-person working notes in site-authored text', texts.flatMap((f) => {
  if (f.rel.endsWith('.json')) {
    const hits = [];
    for (const [where, s] of authoredStrings(JSON.parse(f.text), f.rel)) {
      const m = s.match(FIRST_PERSON);
      if (m) hits.push(`${where}: ${JSON.stringify(m[0])}`);
    }
    return hits;
  }
  return scanText(f.rel, f.text, FIRST_PERSON);
}));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

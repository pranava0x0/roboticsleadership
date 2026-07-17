#!/usr/bin/env node
// Regression tests for the curation gate in validate.js.
// Run: node scripts/validate.test.js
import { checkInternalFlags, validateData } from './validate.js';

let failures = 0;
function eq(actual, expected, label) {
  if (actual !== expected) {
    failures++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  } else {
    console.log(`✓ ${label}`);
  }
}
const count = (data) => checkInternalFlags(data).length;

// The shape that shipped 108 uncurated records to the live site (2026-07-16).
eq(count([{ id: 'a', _requires_curator_review: true }]), 1, 'flat record with _requires_curator_review');
eq(count([{ id: 'a', _scraped: true }]), 1, 'flat record with _scraped');
eq(count([{ id: 'a', _scraped: true, _requires_curator_review: true }]), 2, 'both flags on one record counted separately');
eq(count([{ id: 'a' }, { id: 'b', _scraped: true }, { id: 'c' }]), 1, 'only the flagged record in a mixed array');

// A false value is still an unreviewed record: presence is the signal, not truthiness.
eq(count([{ id: 'a', _scraped: false }]), 1, '_scraped: false still fails (presence, not truthiness)');

// Structured documents (supply_chain, us_china) nest records under keys, so the
// walk must reach them — a top-level-only check would miss these entirely.
eq(count({ _meta: {}, companies: [{ id: 'mp', _scraped: true }] }), 1, 'nested record inside a structured document');
eq(count({ sections: [{ metrics: [{ id: 'm1', _requires_curator_review: true }] }] }), 1, 'deeply nested record');

// _meta is a real published envelope field and must never trip the gate.
eq(count({ _meta: { last_updated: '2026-07-16', captured_at: '2026-07-16' }, data: [] }), 0, '_meta envelope is allowed');

// Clean data and edge shapes.
eq(count([{ id: 'a' }, { id: 'b' }]), 0, 'clean array passes');
eq(count([]), 0, 'empty array');
eq(count({}), 0, 'empty object');
eq(count([{ id: 'a', tags: ['x'], sources: [{ url: 'https://e.com' }] }]), 0, 'normal record with arrays/objects passes');
eq(count({ a: null, b: 'str', c: 42 }), 0, 'null and primitive values do not crash the walk');

// The message must name the record, or a CI failure is unactionable.
const msg = checkInternalFlags([{ id: 'fr-widget', _scraped: true }])[0];
eq(msg.includes('fr-widget'), true, 'error message names the offending record id');
eq(msg.includes('_scraped'), true, 'error message names the offending flag');

// --- The gate must be WIRED, not merely present. -------------------------
// Everything above passes even if validateData never calls checkInternalFlags,
// which is how the flagged records reached production in the first place. These
// assert the connection: schema-valid data that carries a flag must still fail.
// A valid news record — sound schema, so only the gate can reject it.
const validNews = {
  id: 'n1', title: 'T', date: '2026-07-16', source: 's', source_url: 'https://e.com',
  summary: 'S', category: 'Policy', sentiment: 'Neutral', confidence: 'High',
};
eq(validateData('news', [validNews]).ok, true, 'wiring: clean schema-valid record passes');
eq(validateData('news', [{ ...validNews, _scraped: true }]).ok, false,
  'wiring: _scraped makes a schema-valid record FAIL validation');
eq(validateData('news', [{ ...validNews, _requires_curator_review: true }]).ok, false,
  'wiring: _requires_curator_review makes a schema-valid record FAIL validation');
eq(validateData('news', [{ ...validNews, _scraped: true }]).errors.some(e => e.includes('_scraped')), true,
  'wiring: the flag error surfaces in validateData errors[]');

// Structured documents route through a different branch — gate it too.
eq(validateData('supply_chain', { _meta: { last_updated: '2026-07-16' }, companies: [{ id: 'c', _scraped: true }] }).ok,
  false, 'wiring: gate reaches structured documents, not just record arrays');

// --- The two-mode contract that makes the gate mean anything --------------
// The scrapers mark every new record, so the same validator has to permit the
// marker on the scrape path and reject it on the deploy path. Get this
// backwards in either direction and the invariant dies silently: a strict
// scrape path breaks the nightly cron, and a lenient deploy path ships
// uncurated records — which is exactly the hole that existed before, when the
// scrapers set no marker at all and the gate guarded nothing new.
const freshlyScraped = { ...validNews, tags: ['rss-import'], _requires_curator_review: true };
eq(validateData('news', [freshlyScraped], { allowUncurated: true }).ok, true,
  'two-mode: scrape path ACCEPTS a freshly-marked record (else the cron breaks)');
eq(validateData('news', [freshlyScraped]).ok, false,
  'two-mode: deploy path REJECTS the same record (else uncurated data ships)');

// Curating == clearing the flag. That handshake is the whole contract.
const curated = { ...freshlyScraped };
delete curated._requires_curator_review;
eq(validateData('news', [curated]).ok, true, 'two-mode: clearing the flag releases the record to deploy');

// allowUncurated must relax ONLY the gate — schema errors still fail, or the
// scrape path would happily commit malformed records.
eq(validateData('news', [{ ...freshlyScraped, category: 'NotACategory' }], { allowUncurated: true }).ok, false,
  'two-mode: allowUncurated does not suppress schema errors');
eq(validateData('news', [{ ...validNews, category: 'NotACategory' }], { allowUncurated: true }).ok, false,
  'two-mode: allowUncurated does not suppress schema errors on unflagged records either');

if (failures) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log('\nAll validate tests passed.');

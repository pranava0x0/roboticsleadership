#!/usr/bin/env node
// Regression tests for scraper-policy.js helpers.
// Run: node scripts/scraper-policy.test.js
import { toPolicy, frFieldsQuery, FR_FIELDS } from './scraper-policy.js';

let failures = 0;
function eq(actual, expected, label) {
  if (actual !== expected) {
    failures++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  } else {
    console.log(`✓ ${label}`);
  }
}

const doc = {
  document_number: '2026-23799', html_url: 'https://www.federalregister.gov/documents/2026/11/23/2026-23799/x',
  title: 'NIOSH CORR; Request for Information', type: 'Notice', abstract: 'RFI', publication_date: '2026-11-23',
  agency_names: ['Health and Human Services Department'], comments_close_on: '2027-02-22',
};

// 2026-11-22: five records carried comment deadlines typed by hand; the API has the date.
eq(toPolicy(doc, '2026-11-22').comment_deadline, '2027-02-22', 'comments_close_on becomes comment_deadline');
eq('comment_deadline' in toPolicy({ ...doc, comments_close_on: null }, '2026-11-22'), false, 'no deadline field when the notice has none');
eq('comment_deadline' in toPolicy({ ...doc, comments_close_on: 'soon' }, '2026-11-22'), false, 'a malformed date is not copied');
eq(toPolicy(doc, '2026-11-22')._requires_curator_review, true, 'every scraped policy is born uncurated');
eq(toPolicy(doc, '2026-11-22').id, 'fedreg-2026-23799', 'id from the document number');
// Naming fields[] replaces the API's default set, so every field toPolicy reads must be requested.
for (const f of ['document_number', 'html_url', 'title', 'type', 'abstract', 'publication_date', 'agency_names', 'comments_close_on']) {
  eq(FR_FIELDS.includes(f), true, `requests ${f}`);
}
eq(frFieldsQuery().startsWith('&fields%5B%5D='), true, 'fields query is URL-encoded');

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nscraper-policy: all passed');

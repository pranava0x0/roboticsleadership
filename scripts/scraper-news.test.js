#!/usr/bin/env node
// Regression tests for scraper-news.js helpers.
// Run: node scripts/scraper-news.test.js
import { decodeEntities, isRecent } from './scraper-news.js';
import { droppedKeys } from './dropped.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let failures = 0;
function eq(actual, expected, label) {
  if (actual !== expected) {
    failures++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  } else {
    console.log(`✓ ${label}`);
  }
}

// The exact record that triggered the bug.
eq(
  decodeEntities('2026 Robotics Summit &#038; Expo'),
  '2026 Robotics Summit & Expo',
  'numeric decimal &#038; → &'
);

// Named entities.
eq(decodeEntities('a &amp; b'), 'a & b', 'named &amp;');
eq(decodeEntities('5 &lt; 10 &gt; 2'), '5 < 10 > 2', 'named &lt; / &gt;');
eq(decodeEntities('she said &quot;hi&quot;'), 'she said "hi"', 'named &quot;');
eq(decodeEntities('it&apos;s'), "it's", 'named &apos;');
eq(decodeEntities('year&#8217;s end'), 'year’s end', 'numeric &#8217; → ’');
eq(decodeEntities('thriving &#8212; here'), 'thriving — here', 'numeric &#8212; → —');

// Hex numeric form.
eq(decodeEntities('A&#x26;B'), 'A&B', 'numeric hex &#x26; → &');

// Mixed + idempotence on already-clean strings.
eq(decodeEntities('Plain title, no entities'), 'Plain title, no entities', 'no-op on clean string');
eq(decodeEntities(''), '', 'empty string');
eq(decodeEntities(undefined), undefined, 'undefined passthrough');

// XSS safety: decoding must NOT introduce live markup that bypasses the render
// escape. We decode to literal chars; the renderer re-escapes. Verify the
// decoded literal "<" is present (renderer's job to escape it on output).
eq(decodeEntities('&lt;img src=x&gt;'), '<img src=x>', 'decodes to literal (render layer re-escapes)');

// isRecent: date-range cutoff logic.
eq(isRecent('2026-06-01', '2026-05-31'), true,  'isRecent: within window');
eq(isRecent('2026-05-30', '2026-05-31'), false, 'isRecent: before cutoff');
eq(isRecent('2026-05-31', '2026-05-31'), true,  'isRecent: equal to cutoff');

// droppedKeys: rejected candidates from both log shapes the refresh has written.
const dir = mkdtempSync(join(tmpdir(), 'dropped-'));
writeFileSync(join(dir, 'refresh-2026-10-20-dropped.json'), JSON.stringify([{ run: 'x', dropped: [{ id: 'hn-1', source_url: 'https://a.example/1' }] }]));
writeFileSync(join(dir, 'refresh-2026-11-08-dropped.json'), JSON.stringify({ news: [{ id: 'fedreg-news-2026-22739', source_url: 'https://www.federalregister.gov/d/2026-22739' }], policies: [{ id: 'fedreg-2026-22743', title: 'Medicare' }] }));
writeFileSync(join(dir, 'refresh-2026-11-09-dropped.json'), '{not json');
writeFileSync(join(dir, 'other.json'), JSON.stringify({ id: 'not-a-drop-log' }));
const keys = droppedKeys(dir);
eq(keys.has('https://a.example/1'), true, 'droppedKeys: url from the {run, dropped} shape');
eq(keys.has('https://www.federalregister.gov/d/2026-22739'), true, 'droppedKeys: url from the {news, policies} shape');
eq(keys.has('fedreg-2026-22743'), true, 'droppedKeys: policy id with no url');
eq(keys.has('not-a-drop-log'), false, 'droppedKeys: ignores files that are not drop logs');
eq(droppedKeys(join(dir, 'missing')).size, 0, 'droppedKeys: missing dir is empty, not a crash');
rmSync(dir, { recursive: true });

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log('\nAll tests passed.');

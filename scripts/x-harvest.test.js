#!/usr/bin/env node
// Tests for the X list harvest snippet (scripts/x-harvest.browser.js): the parts
// that decide what is kept, what media needs eyes, and what the export prints.
//   node scripts/x-harvest.test.js
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'scripts/x-harvest.browser.js'), 'utf8');

function load() {
  const sandbox = Object.create(null);
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox);
  return sandbox.__xh;
}

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); } catch (e) { failed++; console.log(`✗ ${name}\n    ${e.message}`); }
}
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

const xh = load();

test('counts read X abbreviations', () => {
  eq([xh.parseCount('1.2K'), xh.parseCount('3M'), xh.parseCount('1,204'), xh.parseCount('')], [1200, 3000000, 1204, 0], 'parseCount');
});

test('engagement comes from the action bar aria-label', () => {
  eq(xh.parseEngagement('12 replies, 34 reposts, 1,204 likes, 8 bookmarks, 45678 views'),
    { replies: 12, reposts: 34, likes: 1204, bookmarks: 8, views: 45678 }, 'full label');
  eq(xh.parseEngagement('1 reply, 2.5K views'), { replies: 1, reposts: 0, likes: 0, bookmarks: 0, views: 2500 }, 'singular, partial');
  eq(xh.parseEngagement(null).likes, 0, 'missing label');
});

test('video is skipped unless engagement is very high', () => {
  const low = { video: true, eng: { views: 5000, likes: 40, reposts: 3 } };
  const viral = { video: true, eng: { views: 250000, likes: 300, reposts: 10 } };
  const liked = { video: true, eng: { views: 0, likes: 1500, reposts: 0 } };
  eq([xh.mediaPlan(low).video, xh.mediaPlan(viral).video, xh.mediaPlan(liked).video], ['skip', 'review', 'review'], 'video plan');
  eq(xh.mediaPlan({ video: false, eng: {} }).video, 'none', 'no video');
});

test('images are read from alt text, and viewed only when alt says nothing', () => {
  eq(xh.mediaPlan({ images: [{ id: 'a', alt: 'Chart of humanoid shipments by quarter' }] }).images, 'alt', 'described');
  eq(xh.mediaPlan({ images: [{ id: 'a', alt: 'Image' }] }).images, 'view', 'X default alt');
  eq(xh.mediaPlan({ images: [{ id: 'a', alt: 'x' }, { id: 'b', alt: '' }] }).images, 'view', 'one empty');
  eq(xh.mediaPlan({ images: [] }).images, 'none', 'no images');
});

test('keep matches robotics and money words across text, quote, card and alt', () => {
  eq(xh.keep({ text: 'Unitree ships H2' }), true, 'company');
  eq(xh.keep({ text: 'great thread', quote: 'Series B led by a16z' }), true, 'quote');
  eq(xh.keep({ text: 'look', images: [{ alt: 'humanoid on a line' }] }), true, 'alt');
  eq(xh.keep({ text: 'my coffee this morning' }), false, 'noise');
});

test('export never carries = & ? or non-ASCII, and media shrinks to an id', () => {
  eq(xh.clean('a=b&c?d — é', 50), 'a%3Db%26c%3Fd', 'clean');
  eq(xh.mediaId('https://pbs.twimg.com/media/GxYz_12-ab?format=jpg&name=small'), 'GxYz_12-ab', 'mediaId');
});

test('dump pages kept posts newest first under the budget, and plan lists what needs eyes', () => {
  const x = load();
  const mk = (n, extra) => Object.assign({ url: `/u/status/${n}`, t: `2026-11-1${n}T10:00`, text: `robot post ${n} `.repeat(20), quote: '', card: '', images: [], video: false, eng: { likes: n, reposts: 0, views: 0 } }, extra);
  const items = [mk(1), mk(2, { video: true, eng: { likes: 5000, reposts: 0, views: 0 } }), mk(3, { images: [{ id: 'M3', alt: 'Image' }] }), mk(4, { text: 'lunch' })];
  for (const i of items) { i.keep = x.keep(i); i.plan = x.mediaPlan(i); x.seen.set(i.url, i); }
  const first = x.dump(0, 400);
  if (!/^0 \| 2026-11-13/.test(first)) throw new Error(`not newest first:\n${first}`);
  if (/[=&?]/.test(first)) throw new Error('dump carries = & ?');
  const next = Number((first.match(/NEXT (\d+)/) || [])[1]);
  if (!next) throw new Error(`no NEXT marker under a 400-char budget:\n${first}`);
  if (!/END 3$/.test(x.dump(next, 4000))) throw new Error('lunch post kept, or END count wrong');
  const p = x.plan();
  if (!/view images 1: 0:M3/.test(p)) throw new Error(`image plan wrong:\n${p}`);
  if (!/review videos 1: 1:\/u\/status\/2/.test(p)) throw new Error(`video plan wrong:\n${p}`);
  // Picking posts from the text first narrows what needs eyes, keeping the kept-list index.
  const picked = x.plan([1]);
  if (!/view images 0:/.test(picked) || !/review videos 1: 1:/.test(picked)) throw new Error(`picked plan wrong:\n${picked}`);
});

test('a post whose video is skipped keeps its text and alt text in the export', () => {
  const x = load();
  const v = { url: '/u/status/9', t: '2026-11-11T09:00', text: 'Factory tour', quote: '', card: '', images: [{ id: 'P1', alt: 'Image' }],
    video: true, videoAlt: 'Humanoid robots unloading totes on an assembly line', eng: { likes: 10, reposts: 0, views: 900 } };
  v.keep = x.keep(v); v.plan = x.mediaPlan(v); x.seen.set(v.url, v);
  eq([v.keep, v.plan.video], [true, 'skip'], 'kept on the video description alone, video skipped');
  const out = x.dump(0, 4000);
  if (!/Factory tour/.test(out) || !/ALT: Humanoid robots unloading/.test(out)) throw new Error(`text or alt dropped:\n${out}`);
  if (/ALT:[^|]*Image/.test(out)) throw new Error('X default "Image" alt leaked into the export');
});

test('re-pasting the snippet keeps what was already collected', () => {
  const sandbox = Object.create(null);
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox);
  sandbox.__xh.seen.set('/a/status/1', { url: '/a/status/1' });
  vm.runInNewContext(src, sandbox);
  eq(sandbox.__xh.seen.size, 1, 'seen survives a second paste');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

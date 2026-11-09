// Ids and URLs of scraper candidates a curator already rejected, read from
// data/research/refresh-*-dropped.json. Without this the scrapers re-add the
// same Federal Register notices every run (the Medicare fee schedules came
// back on 11-05, 11-06, 11-07, 11-08 and 11-09). The files have had several
// shapes, so walk them and collect every id / url-like string field.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const KEYS = new Set(['id', 'source_url', 'url', 'html_url']);

export function droppedKeys(dir) {
  const out = new Set();
  let files = [];
  try {
    files = readdirSync(dir).filter(f => /^refresh-.*-dropped\.json$/.test(f));
  } catch (e) {
    console.warn(`No dropped-candidate logs read from ${dir}: ${e.message}`);
    return out;
  }
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (KEYS.has(k) && typeof x === 'string' && x) out.add(x);
      else walk(x);
    }
  };
  for (const f of files) {
    try {
      walk(JSON.parse(readFileSync(resolve(dir, f), 'utf8')));
    } catch (e) {
      console.warn(`Skipping unreadable ${f}: ${e.message}`);
    }
  }
  return out;
}

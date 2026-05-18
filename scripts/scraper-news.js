#!/usr/bin/env node
/**
 * scraper-news.js — fetch RSS feeds from sources.json and append new items to news.json.
 *
 * No dependencies. Node 18+ (uses built-in fetch).
 *
 * Behavior:
 *   - For each entry in sources.news[] with enabled:true, fetch the URL.
 *   - Parse RSS (basic regex parser — handles RSS 2.0 + Atom).
 *   - Filter by keywords[] if provided.
 *   - Deduplicate against existing news.json by source_url.
 *   - For each new item, write a stub record with:
 *       category: best-effort keyword guess, defaulting to "Research"
 *       impact_tier: "Medium"
 *       sentiment: "Neutral"
 *       confidence: "Medium"
 *       requires_verification: true  (curator should review before tagging companies/policies)
 *   - Write back news.json, sorted newest-first.
 *
 * Usage:
 *   node scripts/scraper-news.js              # run all enabled sources
 *   node scripts/scraper-news.js --dry-run    # parse, don't write
 *   node scripts/scraper-news.js --source=ieee-spectrum-robotics  # single source
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const NEWS_FILE = resolve(ROOT, 'docs/data/news.json');
const SOURCES_FILE = resolve(ROOT, 'docs/data/sources.json');

const UA = 'RoboticsTrackerBot/0.1 (+https://github.com/pranava0x0/roboticsleadership)';

// ----- args -----
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const onlySource = (args.find((a) => a.startsWith('--source=')) || '').split('=')[1];

// ----- helpers -----
function load(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
function save(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n');
}
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function decodeEntities(s) {
  if (!s) return '';
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function pickTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(re);
  return m ? decodeEntities(m[1]) : '';
}
function pickLink(xml) {
  // Try <link>...</link> first, then <link href="..."/> (Atom)
  let m = xml.match(/<link[^>]*>([^<]+)<\/link>/i);
  if (m && m[1].trim()) return m[1].trim();
  m = xml.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return m ? m[1].trim() : '';
}
function parseDate(s) {
  if (!s) return todayISO();
  const d = new Date(s);
  if (isNaN(d.getTime())) return todayISO();
  return d.toISOString().slice(0, 10);
}

// Basic RSS / Atom parser — extracts items.
function parseFeed(xml) {
  if (!xml) return [];
  // RSS 2.0
  const items = [];
  const itemRegex = /<item[\s>][\s\S]*?<\/item>/gi;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[0];
    items.push({
      title: pickTag(block, 'title'),
      link: pickLink(block),
      pubDate: pickTag(block, 'pubDate') || pickTag(block, 'dc:date'),
      description: pickTag(block, 'description') || pickTag(block, 'content:encoded'),
    });
  }
  if (items.length > 0) return items;
  // Atom
  const entryRegex = /<entry[\s>][\s\S]*?<\/entry>/gi;
  while ((m = entryRegex.exec(xml)) !== null) {
    const block = m[0];
    items.push({
      title: pickTag(block, 'title'),
      link: pickLink(block),
      pubDate: pickTag(block, 'updated') || pickTag(block, 'published'),
      description: pickTag(block, 'summary') || pickTag(block, 'content'),
    });
  }
  return items;
}

// Federal Register JSON API parser
function parseFederalRegister(json) {
  if (!json || !Array.isArray(json.results)) return [];
  return json.results.map((r) => ({
    title: r.title,
    link: r.html_url,
    pubDate: r.publication_date,
    description: r.abstract || r.summary || '',
  }));
}

function categorize(title, summary) {
  const blob = `${title} ${summary}`.toLowerCase();
  if (/(raise|raised|raising|funding|series\s+[a-f]|seed round|valuation|invest)/i.test(blob)) return 'Funding';
  if (/(deploy|deployment|launch|customer|partnership|pilot|signed.*contract)/i.test(blob)) return 'Deployment';
  if (/(bill|congress|legislation|regulation|federal register|signed into law|rule)/i.test(blob)) return 'Policy';
  if (/(china|export|tariff|sanction|geopolitic)/i.test(blob)) return 'Geopolitics';
  if (/(supply chain|battery|actuator|lidar|chip|component)/i.test(blob)) return 'Supply Chain';
  if (/(vs\.|compete|rival|market share|competitor)/i.test(blob)) return 'Competitive';
  return 'Research';
}

async function fetchSource(src) {
  const headers = { 'User-Agent': UA, Accept: '*/*' };
  console.log(`  → fetching ${src.url}`);
  // Respectful 1.5s delay between hosts (per-source pace handled by sequential loop)
  const res = await fetch(src.url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const text = await res.text();
  if (src.type === 'federal-register-search') {
    return parseFederalRegister(JSON.parse(text));
  }
  return parseFeed(text);
}

function buildRecord(item, src, existingIds) {
  const title = item.title?.slice(0, 240) || '';
  if (!title || !item.link) return null;
  const date = parseDate(item.pubDate);
  let id = slugify(title + '-' + date);
  let n = 1;
  while (existingIds.has(id)) {
    id = slugify(title + '-' + date) + '-' + n++;
  }
  return {
    id,
    title,
    date,
    source: src.id,
    source_type: src.type === 'rss' ? 'News' : src.type === 'federal-register-search' ? 'Press Release' : 'News',
    source_url: item.link,
    summary:
      (item.description?.slice(0, 700) || '').trim() ||
      `(no abstract from feed — see original: ${title.slice(0, 100)})`,
    category: categorize(title, item.description || ''),
    companies: [],
    policies: [],
    themes: [],
    sentiment: 'Neutral',
    confidence: 'Medium',
    tags: ['auto-scraped', `source:${src.id}`],
    _scraped: true,
    _requires_curator_review: true,
  };
}

async function main() {
  const sources = load(SOURCES_FILE);
  const news = load(NEWS_FILE);
  const seenUrls = new Set(news.map((n) => n.source_url));
  const seenIds = new Set(news.map((n) => n.id));

  const enabled = (sources.news || []).filter((s) => s.enabled);
  const filtered = onlySource ? enabled.filter((s) => s.id === onlySource) : enabled;
  if (filtered.length === 0) {
    console.error('No enabled news sources match.');
    process.exit(1);
  }

  let added = 0;
  let attempted = 0;
  let failedSources = 0;

  for (const src of filtered) {
    console.log(`\n[${src.id}]`);
    try {
      const items = await fetchSource(src);
      console.log(`  → parsed ${items.length} items`);
      attempted += items.length;
      for (const item of items) {
        if (!item.link) continue;
        if (seenUrls.has(item.link)) continue;
        // keyword filter
        if (src.keywords && src.keywords.length > 0) {
          const blob = `${item.title} ${item.description}`.toLowerCase();
          if (!src.keywords.some((k) => blob.includes(String(k).toLowerCase()))) continue;
        }
        const rec = buildRecord(item, src, seenIds);
        if (!rec) continue;
        seenUrls.add(rec.source_url);
        seenIds.add(rec.id);
        news.push(rec);
        added += 1;
      }
      // Update last_run timestamp (in-memory; written below if not dry-run)
      src.last_run = new Date().toISOString();
    } catch (err) {
      console.error(`  ✗ ${err.message}`);
      failedSources += 1;
    }
    // 1.5s pause between hosts (DESIGN.md / CLAUDE.md rate-limit norm)
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Sort newest first
  news.sort((a, b) => (a.date < b.date ? 1 : -1));

  console.log(`\nSummary: ${added} new items appended (${attempted} parsed, ${failedSources} sources failed).`);

  if (DRY) {
    console.log('Dry run — nothing written.');
    return;
  }

  save(NEWS_FILE, news);
  save(SOURCES_FILE, sources);
  console.log(`Wrote ${NEWS_FILE} (${news.length} total records).`);
  console.log(`Wrote ${SOURCES_FILE} (updated last_run timestamps).`);
  console.log(`\nReview new items with: node scripts/validate.js news`);
  console.log(`Curator pass needed: tag companies[], policies[], themes[]; set impact_tier; remove _requires_curator_review.`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

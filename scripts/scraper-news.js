#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const DATA_DIR = resolve(ROOT, 'docs/data');

const newsFile = resolve(DATA_DIR, 'news.json');
const sourcesFile = resolve(DATA_DIR, 'sources.json');

// Parse --days=N from argv (default: 3)
function parseDays() {
  const arg = process.argv.find(a => a.startsWith('--days='));
  if (arg) {
    const n = parseInt(arg.split('=')[1], 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return 3;
}

// Decode HTML entities that survive RSS feeds (numeric &#NNN;/&#xNN; and the
// common named ones). Storage holds literal characters; the render layer
// (escapeHTML in app.js) re-escapes on output, so this stays XSS-safe.
const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  mdash: '—', ndash: '–', hellip: '…'
};
export function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|rsquo|lsquo|ldquo|rdquo|mdash|ndash|hellip);/g,
      (m, name) => NAMED_ENTITIES[name] ?? m);
}

// Extremely simple XML/RSS regex parser
function parseRSS(xmlStr) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xmlStr)) !== null) {
    const itemBlock = match[1];
    const titleMatch = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i.exec(itemBlock);
    const linkMatch = /<link>([\s\S]*?)<\/link>/i.exec(itemBlock);
    const pubDateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(itemBlock);
    const descMatch = /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/i.exec(itemBlock);

    if (titleMatch && linkMatch) {
      items.push({
        title: decodeEntities((titleMatch[1] || titleMatch[2] || '').trim()),
        link: linkMatch[1].trim(),
        pubDate: pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString(),
        description: decodeEntities((descMatch ? (descMatch[1] || descMatch[2] || '') : '').replace(/<[^>]*>?/gm, '').trim())
      });
    }
  }
  return items;
}

function categorize(text) {
  const t = text.toLowerCase();
  if (t.includes('funding') || t.includes('raised') || t.includes('series')) return 'Funding';
  if (t.includes('policy') || t.includes('bill') || t.includes('regulation')) return 'Policy';
  if (t.includes('research') || t.includes('paper') || t.includes('study')) return 'Research';
  if (t.includes('deploy') || t.includes('pilot') || t.includes('customer')) return 'Deployment';
  return 'Competitive';
}

function makeId(title) {
  let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (slug.length > 30) slug = slug.substring(0, 30).replace(/-$/, '');
  return `rss-${slug}-${Math.floor(Math.random() * 1000)}`;
}

function toDateStr(raw) {
  try {
    const d = new Date(raw);
    if (!isNaN(d.valueOf())) return d.toISOString().split('T')[0];
  } catch (_) {}
  return new Date().toISOString().split('T')[0];
}

// Returns true if dateStr is within the last `days` calendar days.
function isRecent(dateStr, cutoff) {
  return dateStr >= cutoff;
}

async function handleRss(source, news, existingUrls, cutoff, today) {
  console.log(`Fetching RSS from ${source.url}...`);
  const res = await fetch(source.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    }
  });
  if (!res.ok) {
    console.error(`  Failed: HTTP ${res.status}`);
    return 0;
  }
  const xml = await res.text();
  const items = parseRSS(xml);

  let added = 0;
  for (const item of items) {
    if (existingUrls.has(item.link)) continue;
    const dateStr = toDateStr(item.pubDate);
    if (!isRecent(dateStr, cutoff)) continue; // skip items older than cutoff

    const summary = item.description.substring(0, 200) + (item.description.length >= 200 ? '...' : '') || item.title;
    const record = {
      id: makeId(item.title),
      title: item.title,
      date: dateStr,
      source: source.id,
      source_type: 'News',
      source_url: item.link,
      summary,
      category: categorize(item.title + ' ' + item.description),
      companies: [],
      policies: [],
      themes: [],
      sentiment: 'Neutral',
      confidence: 'Medium',
      tags: ['rss-import']
    };
    news.unshift(record);
    existingUrls.add(item.link);
    added++;
  }
  console.log(`  Added ${added} from ${source.id} (cutoff ${cutoff})`);
  return added;
}

async function handleFederalRegister(source, news, existingUrls, cutoff, today) {
  const url = `${source.url}&conditions%5Bpublication_date%5D%5Bgte%5D=${cutoff}&per_page=20`;
  console.log(`Fetching Federal Register news from ${url}...`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'robotics-tracker/1.0 (https://github.com/pranava0x0/roboticsleadership)' }
  });
  if (!res.ok) {
    console.error(`  Failed: HTTP ${res.status}`);
    return 0;
  }
  const data = await res.json();
  let added = 0;
  for (const doc of data.results || []) {
    if (existingUrls.has(doc.html_url)) continue;
    const dateStr = doc.publication_date || today;
    if (!isRecent(dateStr, cutoff)) continue;

    const rawSummary = doc.abstract || doc.title;
    const summary = rawSummary.substring(0, 200) + (rawSummary.length >= 200 ? '...' : '');
    const record = {
      id: `fedreg-news-${doc.document_number}`.toLowerCase(),
      title: doc.title,
      date: dateStr,
      source: source.id,
      source_type: 'Government',
      source_url: doc.html_url,
      summary,
      category: categorize(doc.title + ' ' + (doc.abstract || '')),
      companies: [],
      policies: [],
      themes: [],
      sentiment: 'Neutral',
      confidence: 'Medium',
      tags: ['federal-register', 'rss-import']
    };
    news.unshift(record);
    existingUrls.add(doc.html_url);
    added++;
  }
  console.log(`  Added ${added} from ${source.id} (cutoff ${cutoff})`);
  return added;
}

async function handleReddit(source, news, existingUrls, cutoff, today) {
  const cutoffTs = new Date(cutoff).getTime() / 1000;
  const url = `${source.url}?limit=100&sort=new`;
  console.log(`Fetching Reddit from ${url}...`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'robotics-tracker/1.0 (Node.js; +https://github.com/pranava0x0/roboticsleadership)' }
  });
  if (!res.ok) {
    console.error(`  Failed: HTTP ${res.status}`);
    return 0;
  }
  const data = await res.json();
  const posts = (data?.data?.children || []).map(c => c.data);
  const keywords = source.keywords || [];

  let added = 0;
  for (const post of posts) {
    if (existingUrls.has(post.url)) continue;
    if (post.created_utc < cutoffTs) continue; // older than cutoff

    // Keyword filter — only ingest if any keyword appears in title or selftext
    if (keywords.length > 0) {
      const txt = (post.title + ' ' + (post.selftext || '')).toLowerCase();
      if (!keywords.some(k => txt.includes(k.toLowerCase()))) continue;
    }

    const postUrl = post.url.startsWith('http') ? post.url : `https://www.reddit.com${post.permalink}`;
    const dateStr = toDateStr(new Date(post.created_utc * 1000).toISOString());
    const summary = (post.selftext || post.title).substring(0, 200) + ((post.selftext || '').length >= 200 ? '...' : '');

    const record = {
      id: `reddit-${post.id}`,
      title: post.title,
      date: dateStr,
      source: source.id,
      source_type: 'Community',
      source_url: postUrl,
      summary: summary || post.title,
      category: categorize(post.title + ' ' + (post.selftext || '')),
      companies: [],
      policies: [],
      themes: [],
      sentiment: 'Neutral',
      confidence: 'Low',
      tags: ['reddit', 'community']
    };
    news.unshift(record);
    existingUrls.add(post.url);
    added++;
  }
  console.log(`  Added ${added} from ${source.id} (cutoff ${cutoff})`);
  return added;
}

async function main() {
  const days = parseDays();
  const today = new Date().toISOString().split('T')[0];
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  console.log(`Fetching news from the last ${days} days (cutoff: ${cutoff})`);

  const sourcesData = JSON.parse(readFileSync(sourcesFile, 'utf8'));
  const news = JSON.parse(readFileSync(newsFile, 'utf8'));
  const existingUrls = new Set(news.map(n => n.source_url));
  let addedTotal = 0;

  const enabledSources = sourcesData.news.filter(s => s.enabled);

  for (const source of enabledSources) {
    try {
      if (source.type === 'rss') {
        addedTotal += await handleRss(source, news, existingUrls, cutoff, today);
      } else if (source.type === 'federal-register-search') {
        addedTotal += await handleFederalRegister(source, news, existingUrls, cutoff, today);
      } else if (source.type === 'reddit-json') {
        addedTotal += await handleReddit(source, news, existingUrls, cutoff, today);
      } else {
        console.log(`  Skipping ${source.id} (unhandled type: ${source.type})`);
      }
      source.last_run = today;
    } catch (e) {
      console.error(`Error processing ${source.url}:`, e.message);
    }
  }

  if (addedTotal > 0) {
    writeFileSync(newsFile, JSON.stringify(news, null, 2));
    console.log(`\nAdded ${addedTotal} new news records total.`);
  } else {
    console.log('\nNo new news found.');
  }

  sourcesData._meta.last_updated = today;
  writeFileSync(sourcesFile, JSON.stringify(sourcesData, null, 2) + '\n');
}

// Only run the scraper when invoked directly, so importing decodeEntities
// (e.g. from the regression test) doesn't trigger network fetches.
if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

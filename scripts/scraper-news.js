#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const DATA_DIR = resolve(ROOT, 'docs/data');

const newsFile = resolve(DATA_DIR, 'news.json');
const sourcesFile = resolve(DATA_DIR, 'sources.json');

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
        title: (titleMatch[1] || titleMatch[2] || '').trim(),
        link: linkMatch[1].trim(),
        pubDate: pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString(),
        description: (descMatch ? (descMatch[1] || descMatch[2] || '') : '').replace(/<[^>]*>?/gm, '').trim()
      });
    }
  }
  return items;
}

async function main() {
  const sourcesData = JSON.parse(readFileSync(sourcesFile, 'utf8'));
  const news = JSON.parse(readFileSync(newsFile, 'utf8'));
  const existingUrls = new Set(news.map(n => n.source_url));
  let addedTotal = 0;

  const today = new Date().toISOString().split('T')[0];
  const newsSources = sourcesData.news.filter(s => s.type === 'rss' && s.enabled);

  for (const source of newsSources) {
    console.log(`Fetching from ${source.url}...`);
    try {
      const res = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) {
        console.error(`Failed to fetch ${source.url}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const items = parseRSS(xml);

      let addedForSource = 0;
      for (const item of items) {
        if (existingUrls.has(item.link)) continue;

        let dateStr = today;
        try {
          const d = new Date(item.pubDate);
          if (!isNaN(d.valueOf())) {
            dateStr = d.toISOString().split('T')[0];
          }
        } catch(e){}

        // Basic categorization
        let category = "Competitive";
        const txt = (item.title + ' ' + item.description).toLowerCase();
        if (txt.includes('funding') || txt.includes('raised') || txt.includes('series')) category = "Funding";
        else if (txt.includes('policy') || txt.includes('bill') || txt.includes('regulation')) category = "Policy";
        else if (txt.includes('research') || txt.includes('paper') || txt.includes('study')) category = "Research";
        else if (txt.includes('deploy') || txt.includes('pilot') || txt.includes('customer')) category = "Deployment";

        let summary = item.description.substring(0, 200);
        if (summary.length === 200) summary += '...';
        if (!summary) summary = item.title;

        // Generate ID
        let idSlug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        if (idSlug.length > 30) idSlug = idSlug.substring(0, 30).replace(/-$/, '');
        const newId = `rss-${idSlug}-${Math.floor(Math.random()*1000)}`;

        const newRecord = {
          id: newId,
          title: item.title,
          date: dateStr,
          source: source.id,
          source_type: "News",
          source_url: item.link,
          summary: summary,
          category: category,
          companies: [],
          policies: [],
          themes: [],
          sentiment: "Neutral",
          confidence: "Medium",
          tags: ["rss-import"]
        };

        news.unshift(newRecord); // Add to beginning (newest first)
        existingUrls.add(item.link);
        addedForSource++;
        addedTotal++;
      }
      console.log(`  Added ${addedForSource} from ${source.id}`);
      source.last_run = today;
    } catch (e) {
      console.error(`Error processing ${source.url}:`, e);
    }
  }

  if (addedTotal > 0) {
    writeFileSync(newsFile, JSON.stringify(news, null, 2));
    console.log(`Added ${addedTotal} new news records total.`);
  } else {
    console.log('No new news found.');
  }

  sourcesData._meta.last_updated = today;
  writeFileSync(sourcesFile, JSON.stringify(sourcesData, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

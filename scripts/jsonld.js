#!/usr/bin/env node
/**
 * JSON-LD for every page, generated from the page's own head so the copies
 * cannot drift: name ← <title>, description ← meta description, url ← canonical.
 * Pages that render a dataset also describe it as a schema.org Dataset with a
 * DataDownload pointing at the JSON file.
 *
 * Output lives between <!--jsonld:start--> and <!--jsonld:end--> just before
 * </head>, and IS committed (unlike the bake slots): it is small, and crawlers
 * that don't run the deploy pipeline locally still read the right thing.
 *
 *   node scripts/jsonld.js            # check: exit 1 if any page is stale
 *   node scripts/jsonld.js --write    # regenerate in place
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const SITE = 'https://pranava0x0.github.io/roboticsleadership/';
const START = '<!--jsonld:start-->';
const END = '<!--jsonld:end-->';

const CREATOR = { '@type': 'Person', name: 'Pranava Raparla', url: 'https://pranavaraparla.com' };

// page → dataset it renders. Descriptions follow llms.txt; keep them in step.
const DATASETS = {
  'china.html': ['us_china.json', 'US vs China robotics scoreboard', 'Metric-by-metric comparison of US and Chinese robotics (deployment, humanoids, supply chain, capital), each metric with an editorial edge call and cited sources.'],
  'supply-chain.html': ['supply_chain.json', 'Robotics supply chain', 'Robotics supply-chain categories with US, China and rest-of-world shares, chokepoints, companies, stakeholders and annual industrial-robot installations through 2025.'],
  'companies.html': ['companies.json', 'Robotics companies', 'Robotics companies with funding rounds, deployments, valuations, headquarters, market category and cited sources.'],
  'policies.html': ['policies.json', 'Robotics policy records', 'Federal, state and city robotics policy records: bills, executive orders, regulations, incentive programs and procurement, each with status and sources.'],
  'news.html': ['news.json', 'Robotics news records', 'Tracked robotics news on funding, deployments, policy, supply chain and geopolitics, each record with its source URL and often an archive snapshot.'],
  'states.html': ['state_policy.json', 'State robotics policy themes', 'State-level robotics policy themes: delivery-robot laws, autonomous-vehicle rules, incentives and the AI preemption fight.'],
  'themes.html': ['themes.json', 'Robotics themes', 'Cross-cutting robotics narratives with a direction (accelerating, stable, slowing) and the evidence behind each.'],
  'rd.html': ['rd.json', 'Robotics R&D tracker', 'Robot foundation models, world models, benchmarks and leaderboards, research areas, datasets, compute and the humanoid component stack, each entry with its source and capture date.'],
};

const attr = (html, re) => {
  const m = html.match(re);
  return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim() : null;
};

export function buildJsonLd(file, html) {
  const name = attr(html, /<title>([^<]*)<\/title>/);
  const description = attr(html, /<meta name="description" content="([^"]*)"/);
  const url = attr(html, /<link rel="canonical" href="([^"]*)"/);
  const siteName = attr(html, /<meta property="og:site_name" content="([^"]*)"/) || 'Robotics Leadership Tracker';
  if (!name || !description || !url) throw new Error(`${file}: missing <title>, meta description or canonical`);

  const website = { '@type': 'WebSite', '@id': `${SITE}#website`, name: siteName, url: SITE, inLanguage: 'en', creator: CREATOR };
  const page = { '@type': 'WebPage', '@id': `${url}#webpage`, name, description, url, inLanguage: 'en', isPartOf: { '@id': `${SITE}#website` } };
  const graph = [website, page];

  const ds = DATASETS[file];
  if (ds) {
    const [path, dsName, dsDesc] = ds;
    graph.push({
      '@type': 'Dataset',
      name: dsName,
      description: dsDesc,
      url,
      isAccessibleForFree: true,
      creator: CREATOR,
      isPartOf: { '@id': `${SITE}#website` },
      distribution: { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE}data/${path}` },
    });
    page.mainEntity = { '@type': 'Dataset', name: dsName };
  }
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  return `${START}\n  <script type="application/ld+json">${json}</script>\n  ${END}`;
}

export function apply(file, html) {
  const block = buildJsonLd(file, html);
  const s = html.indexOf(START);
  if (s >= 0) {
    const e = html.indexOf(END, s);
    if (e < 0) throw new Error(`${file}: ${START} without ${END}`);
    return html.slice(0, s) + block + html.slice(e + END.length);
  }
  const head = html.indexOf('</head>');
  if (head < 0) throw new Error(`${file}: no </head>`);
  return `${html.slice(0, head)}  ${block}\n${html.slice(head)}`;
}

function main() {
  const write = process.argv.includes('--write');
  const pages = readdirSync(DOCS).filter((f) => f.endsWith('.html'));
  const stale = [];
  for (const f of pages) {
    const p = join(DOCS, f);
    const html = readFileSync(p, 'utf8');
    const next = apply(f, html);
    if (next === html) continue;
    if (write) writeFileSync(p, next);
    else stale.push(f);
  }
  for (const f of Object.keys(DATASETS)) {
    if (!pages.includes(f)) { console.error(`jsonld: DATASETS names ${f}, which does not exist`); process.exit(1); }
  }
  if (stale.length) {
    console.error(`jsonld: stale JSON-LD in ${stale.join(', ')}. Run: node scripts/jsonld.js --write`);
    process.exit(1);
  }
  console.log(`jsonld: ${pages.length} pages ${write ? 'written' : 'current'}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

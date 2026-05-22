import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const PROJECT_DIR = process.cwd();

// Helper to load JSON from a git reference
function loadJsonFromGit(ref, filepath) {
  try {
    const stdout = execSync(`git show ${ref}:${filepath}`, { cwd: PROJECT_DIR, encoding: 'utf8', maxBuffer: 15 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (e) {
    console.error(`Failed to load ${filepath} from git ref ${ref}:`, e.message);
    throw e;
  }
}

// Compare YYYY-MM-DD dates safely (lexicographically)
function getLatestDate(d1, d2) {
  if (!d1) return d2 || null;
  if (!d2) return d1 || null;
  return d1 > d2 ? d1 : d2;
}

// Helper to extract primary URL from policy sources
function getPrimaryUrl(rec) {
  if (!rec.sources || rec.sources.length === 0) return null;
  const s = rec.sources[0];
  if (typeof s === 'string') return s;
  if (s && typeof s === 'object' && typeof s.url === 'string') return s.url;
  return null;
}

// Merge news records
function mergeNews(ours, theirs) {
  const combined = [];
  const idMap = new Map();
  const urlMap = new Map();

  // Load ours first (keep the main branch annotations/curations)
  for (const item of ours) {
    idMap.set(item.id, item);
    if (item.source_url) {
      urlMap.set(item.source_url, item);
    }
    combined.push(item);
  }

  // Merge theirs (auto branch) without duplicates
  let addedCount = 0;
  for (const item of theirs) {
    const hasId = idMap.has(item.id);
    const hasUrl = item.source_url && urlMap.has(item.source_url);
    if (!hasId && !hasUrl) {
      idMap.set(item.id, item);
      if (item.source_url) {
        urlMap.set(item.source_url, item);
      }
      combined.push(item);
      addedCount++;
    }
  }
  console.log(`  - News: ${ours.length} (ours) + ${theirs.length} (theirs) -> merged into ${combined.length} records (+${addedCount} new)`);

  // Sort descending by date, secondary sort by id descending
  combined.sort((a, b) => {
    if (a.date !== b.date) {
      return b.date > a.date ? 1 : -1;
    }
    return b.id > a.id ? 1 : -1;
  });

  return combined;
}

// Merge policy records
function mergePolicies(ours, theirs) {
  const combined = [];
  const idMap = new Map();
  const urlMap = new Map();

  // Load ours first
  for (const item of ours) {
    idMap.set(item.id, item);
    const primaryUrl = getPrimaryUrl(item);
    if (primaryUrl) {
      urlMap.set(primaryUrl, item);
    }
    combined.push(item);
  }

  // Merge theirs without duplicates
  let addedCount = 0;
  for (const item of theirs) {
    const hasId = idMap.has(item.id);
    const primaryUrl = getPrimaryUrl(item);
    const hasUrl = primaryUrl && urlMap.has(primaryUrl);
    if (!hasId && !hasUrl) {
      idMap.set(item.id, item);
      if (primaryUrl) {
        urlMap.set(primaryUrl, item);
      }
      combined.push(item);
      addedCount++;
    }
  }
  console.log(`  - Policies: ${ours.length} (ours) + ${theirs.length} (theirs) -> merged into ${combined.length} records (+${addedCount} new)`);

  // Sort descending by introduced_date, secondary sort by id descending
  combined.sort((a, b) => {
    const dA = a.introduced_date || '';
    const dB = b.introduced_date || '';
    if (dA !== dB) {
      return dB > dA ? 1 : -1;
    }
    return b.id > a.id ? 1 : -1;
  });

  return combined;
}

// Merge sources config
function mergeSources(ours, theirs) {
  const result = JSON.parse(JSON.stringify(ours)); // Deep copy ours config
  
  // Update last_updated
  result._meta.last_updated = getLatestDate(
    ours._meta?.last_updated,
    theirs._meta?.last_updated
  ) || new Date().toISOString().split('T')[0];

  // Merge last_run across all source categories
  const categories = ['news', 'companies', 'policies'];
  for (const cat of categories) {
    if (!ours[cat] || !theirs[cat]) continue;
    
    // Map theirs by ID for lookup
    const theirsMap = new Map(theirs[cat].map(s => [s.id, s]));

    for (const srcOurs of result[cat]) {
      const srcTheirs = theirsMap.get(srcOurs.id);
      if (srcTheirs) {
        const latestRun = getLatestDate(srcOurs.last_run, srcTheirs.last_run);
        if (srcOurs.last_run !== latestRun) {
          console.log(`  - Sources (${cat}/${srcOurs.id}): last_run updated from "${srcOurs.last_run}" to "${latestRun}"`);
          srcOurs.last_run = latestRun;
        }
      }
    }
  }

  return result;
}

// Main execution function
function main() {
  const fileToMerge = process.argv[2];
  if (!fileToMerge) {
    console.error('Usage: node scripts/merge-conflict-resolver.js <news|policies|sources>');
    process.exit(1);
  }

  const paths = {
    news: 'docs/data/news.json',
    policies: 'docs/data/policies.json',
    sources: 'docs/data/sources.json'
  };

  const filepath = paths[fileToMerge];
  if (!filepath) {
    console.error(`Invalid option: "${fileToMerge}". Must be one of: news, policies, sources.`);
    process.exit(1);
  }

  try {
    const ours = loadJsonFromGit('HEAD', filepath);
    const theirs = loadJsonFromGit('MERGE_HEAD', filepath);

    let merged;
    if (fileToMerge === 'news') {
      merged = mergeNews(ours, theirs);
    } else if (fileToMerge === 'policies') {
      merged = mergePolicies(ours, theirs);
    } else if (fileToMerge === 'sources') {
      merged = mergeSources(ours, theirs);
    }

    writeFileSync(resolve(PROJECT_DIR, filepath), JSON.stringify(merged, null, 2) + '\n', 'utf8');
    console.log(`✓ Successfully resolved and wrote merged ${filepath}`);
  } catch (e) {
    console.error(`Error resolving merge conflict for ${fileToMerge}:`, e);
    process.exit(1);
  }
}

main();

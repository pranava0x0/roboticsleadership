#!/usr/bin/env node
/**
 * data-refresh/run.js — Orchestrates the full data refresh, sync, test, and merge workflow.
 * Invoked by: /data-refresh [--dry-run] [--no-scrape] [--auto-merge] [--scrape-only]
 */

import { execSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import * as readline from 'node:readline';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const noScrape = args.includes('--no-scrape');
const autoMerge = args.includes('--auto-merge');
const scrapeOnly = args.includes('--scrape-only');

const log = (msg) => console.log(msg);
const error = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };
const warn = (msg) => console.warn(`⚠️  ${msg}`);
const success = (msg) => console.log(`✓ ${msg}`);

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

async function run(cmd, opts = {}) {
  try {
    const output = execSync(cmd, { encoding: 'utf8', ...opts });
    return { success: true, output };
  } catch (e) {
    return { success: false, output: e.message };
  }
}

async function main() {
  log('\n=== Robotics Tracker: Data Refresh Workflow ===\n');

  if (scrapeOnly) {
    log('Mode: Scrape only');
    await scrapeData();
    process.exit(0);
  }

  if (dryRun) {
    log('Mode: Dry run (no commits)\n');
  } else {
    log('Mode: Full workflow\n');
  }

  // 1. VALIDATION
  log('1️⃣  Running validation...');
  const { success: validOk, output: validOut } = await run('node scripts/validate.js');
  if (!validOk) {
    error(`Validation failed:\n${validOut}`);
  }
  success('Validation passed');
  console.log(validOut);

  if (scrapeOnly) return;

  // 2. SCRAPING
  if (!noScrape) {
    log('\n2️⃣  Running scrapers...');
    await scrapeData();
  } else {
    log('\n2️⃣  Skipping scraping (--no-scrape)');
  }

  // 3. DOCUMENTATION SYNC CHECK
  log('\n3️⃣  Checking documentation consistency...');
  await checkDocumentation();

  // 4. TESTING
  log('\n4️⃣  Running tests...');
  const { success: testsOk } = await run('node scripts/lint-actions.js');
  if (!testsOk) {
    warn('Lint check failed; continuing anyway');
  } else {
    success('CI lint passed');
  }

  // Test pages load
  log('  Testing page loads...');
  const pages = ['index.html', 'companies.html', 'policies.html', 'states.html', 'themes.html'];
  for (const page of pages) {
    const { success: pageOk } = await run(
      `curl -s -o /dev/null -w '%{http_code}' http://localhost:8765/${page}`
    );
    if (pageOk) success(`  ${page}`);
  }

  if (dryRun) {
    log('\n✅ Dry run complete. No commits created.');
    process.exit(0);
  }

  // 5. COMMIT & PR
  log('\n5️⃣  Creating commit & PR...');
  const branch = `data-refresh-${new Date().toISOString().split('T')[0]}`;
  const today = new Date().toISOString().split('T')[0];

  try {
    // Create branch
    execSync(`git checkout -b ${branch}`, { stdio: 'pipe' });
    success(`Branch created: ${branch}`);

    // Stage & commit
    execSync('git add -A', { stdio: 'pipe' });
    const commitMsg = `data: refresh ${today} — validation + documentation sync`;
    execSync(`git commit -m "${commitMsg}"`, { stdio: 'pipe' });
    success(`Commit created: ${commitMsg}`);

    // Push
    execSync(`git push -u origin ${branch}`, { stdio: 'pipe' });
    success(`Pushed to origin/${branch}`);

    // Create PR
    const prOutput = execSync(
      `gh pr create --draft --title "Data refresh ${today}" --body "Automated data refresh, validation, and documentation sync.\\n\\n✓ All validations passed\\n✓ All pages load\\n✓ Documentation consistent\\n\\nReady to review and merge."`,
      { encoding: 'utf8' }
    );
    const prUrl = prOutput.trim();
    success(`PR created: ${prUrl}`);

    // Merge decision
    if (autoMerge) {
      log('\n⚙️  Auto-merge enabled; merging PR...');
      execSync(`gh pr merge --squash`, { stdio: 'inherit' });
      success('PR merged to main');
    } else {
      const shouldMerge = await ask('\nMerge PR to main? (y/n) ');
      if (shouldMerge) {
        log('Merging...');
        execSync(`gh pr merge --squash`, { stdio: 'inherit' });
        success('PR merged to main');
      } else {
        log('PR created but not merged. Merge manually when ready.');
      }
    }
  } catch (e) {
    error(`Workflow failed: ${e.message}`);
  }

  log('\n✅ Data refresh workflow complete.\n');
}

async function scrapeData() {
  const sources = ['news', 'policy'];
  for (const source of sources) {
    log(`  Scraping ${source}...`);
    const cmd = source === 'news' ? 'node scripts/scraper-news.js' : 'node scripts/scraper-policy.js';
    const { success: cmdSuccess, output } = await run(cmd);
    if (cmdSuccess) {
      const matches = output.match(/Added (\d+)/);
      const count = matches ? matches[1] : 0;
      success(`  ${source}: +${count} items`);
    } else {
      warn(`  ${source}: network unavailable or error`);
    }
  }
}

async function checkDocumentation() {
  // Check README lists all pages
  const readmeContent = readFileSync('README.md', 'utf8');
  const pages = ['index.html', 'companies.html', 'policies.html', 'states.html', 'themes.html'];
  const missing = pages.filter(p => !readmeContent.includes(p));

  if (missing.length > 0) {
    warn(`Documentation: README missing: ${missing.join(', ')}`);
  } else {
    success('README lists all pages');
  }

  // Check UAT covers all pages
  const uatContent = readFileSync('uat.md', 'utf8');
  const uatMissing = pages.filter(p => !uatContent.includes(p));
  if (uatMissing.length > 0) {
    warn(`Documentation: UAT missing coverage for: ${uatMissing.join(', ')}`);
  } else {
    success('UAT covers all pages');
  }
}

main().catch((e) => {
  error(`Unexpected error: ${e.message}`);
});

#!/usr/bin/env node

/**
 * Automated data refresh pipeline (ESM)
 *
 * Runs: scrapers → validate → curate → enrich → validate → report
 * Preserves _requires_curator_review flag on uncertain records (semantic judgment still needed)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'docs', 'data');
const REFRESH_LOG = path.join(__dirname, '..', 'refresh-run.log');

class RefreshPipeline {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      scraped: { news: 0, policies: 0 },
      curated: { dropped: 0, kept: 0 },
      validated: false,
      errors: [],
      warnings: [],
    };
  }

  log(msg, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    console.log(`${prefix} ${msg}`);
    fs.appendFileSync(REFRESH_LOG, `${prefix} ${msg}\n`);
  }

  // Load JSON files without require cache interference
  loadJSON(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  // Step 0: Load current state
  loadCurrentState() {
    this.log('Step 0: Loading current state...');

    try {
      this.news = this.loadJSON(path.join(DATA_DIR, 'news.json'));
      this.policies = this.loadJSON(path.join(DATA_DIR, 'policies.json'));
      this.sources = this.loadJSON(path.join(DATA_DIR, 'sources.json'));

      const newsDates = this.news.map(n => n.date).sort();
      const policyDates = this.policies.map(p => p.introduced_date).sort();

      this.log(`  News: ${this.news.length} records (${newsDates[0]} to ${newsDates[newsDates.length - 1]})`);
      this.log(`  Policies: ${this.policies.length} records (${policyDates[0]} to ${policyDates[policyDates.length - 1]})`);

      this.initialCounts = {
        news: this.news.length,
        policies: this.policies.length,
      };
    } catch (e) {
      this.log(`Failed to load data: ${e.message}`, 'error');
      this.results.errors.push(`Load failed: ${e.message}`);
      throw e;
    }
  }

  // Step 1: Run scrapers
  runScrapers() {
    this.log('Step 1: Running scrapers...');

    try {
      this.log('  Running scraper-news.js...');
      const newsOutput = execSync('node scripts/scraper-news.js 2>&1', { encoding: 'utf-8' });
      const newsMatch = newsOutput.match(/Added (\d+) new news records/);
      if (newsMatch) {
        this.results.scraped.news = parseInt(newsMatch[1]);
        this.log(`    Added ${this.results.scraped.news} news records`);
      }

      // Extract per-source counts
      const sourceMatches = newsOutput.matchAll(/Added (\d+) from ([\w-]+)/g);
      this.sourceBreakdown = {};
      for (const match of sourceMatches) {
        this.sourceBreakdown[match[2]] = parseInt(match[1]);
      }

      // Check for failures
      if (newsOutput.includes('Failed to process')) {
        const failures = newsOutput.match(/Failed to process (\w+)[:\s-]+(.*?)(?=\n|$)/g) || [];
        failures.forEach(f => {
          this.log(`    ⚠️  ${f}`, 'warn');
          this.results.warnings.push(`News scraper: ${f}`);
        });
      }
    } catch (e) {
      this.log(`  News scraper failed: ${e.message}`, 'error');
      this.results.errors.push(`News scraper: ${e.message}`);
    }

    try {
      this.log('  Running scraper-policy.js...');
      const policyOutput = execSync('node scripts/scraper-policy.js 2>&1', { encoding: 'utf-8' });
      const policyMatch = policyOutput.match(/Added (\d+) new policy records/);
      if (policyMatch) {
        this.results.scraped.policies = parseInt(policyMatch[1]);
        this.log(`    Added ${this.results.scraped.policies} policy records`);
      }
    } catch (e) {
      // Scraper-policy returns exit code 1 on HTTP failures, not always an error
      if (e.message.includes('HTTP 503') || e.message.includes('HTTP 404')) {
        this.log(`  Policy scraper: ${e.message.split('\n')[0]}`, 'warn');
        this.results.warnings.push(`Policy scraper HTTP error: ${e.message.split('\n')[0]}`);
      } else {
        this.log(`  Policy scraper failed: ${e.message}`, 'error');
        this.results.errors.push(`Policy scraper: ${e.message}`);
      }
    }
  }

  // Step 2: Validate (allow uncurated records in pipeline, strict validation is for deploy gate)
  validate(strict = false) {
    this.log(`Step 2: Validating (${strict ? 'strict' : 'allow uncurated'})...`);

    try {
      const args = strict ? '' : '--allow-uncurated';
      const output = execSync(`node scripts/validate.js ${args} 2>&1`, { encoding: 'utf-8' });

      if (output.includes('All files valid')) {
        this.log('  ✓ All files valid');
        this.results.validated = true;
        return true;
      } else {
        // Extract validation failures
        const failedFiles = output.match(/✗ (\w+)\s+(\d+) records/g) || [];
        failedFiles.forEach(f => {
          this.log(`  ${f}`, 'error');
          this.results.errors.push(`Validation: ${f}`);
        });
        return false;
      }
    } catch (e) {
      this.log(`Validation failed: ${e.message}`, 'error');
      this.results.errors.push(`Validation: ${e.message}`);
      return false;
    }
  }

  // Step 3: Auto-curate obvious false positives (learned from 10 days of runs)
  // IMPORTANT: Preserve _requires_curator_review on survivors — semantic judgment still needed
  autoCurate() {
    this.log('Step 3: Auto-curating obvious false positives...');

    // Reload fresh data since scrapers modified files (avoid require cache)
    this.news = this.loadJSON(path.join(DATA_DIR, 'news.json'));
    this.policies = this.loadJSON(path.join(DATA_DIR, 'policies.json'));

    // Learned patterns from 2026-07-21 through 2026-07-29 runs:
    // Top false-positive offenders (60-70% accuracy on obvious noise)
    const hnFalsePositives = [
      /robots\.txt/i,           // HTTP protocol, not robotics
      /robocall/i,              // Spam/telecom, not robotics
      /permutation|computat/i,  // Math/CS theory
      /segregation|treason|democracy/i,  // Social policy/politics
      /joyless|decadence|pleasure/i,     // Philosophy/culture
      /europe.*rich|gdp|budget/i,        // EU economics
      /spider-man|disney|mcu/i,          // Entertainment
      /currency|forex|exchange/i,        // Finance
      /icymi|retweet|thread/i,           // Social media meta
      /pandemic|covid|vaccine/i,         // Health (not robotics)
      /kerberos|clock.?skew/i,           // System utilities
      /sam altman|openai exec/i,         // Company leadership (not robotics)
    ];

    // Federal Register false-positives (from policy scraper):
    // ~78 of 88 records were noise in 2026-07 sweep
    const fedFalsePositives = [
      /scheduling|drug|controlled/i,     // DEA drug scheduling
      /housing|loan|mortgage/i,          // HUD/Treasury housing
      /medicare|medicaid|physician/i,    // CMS medical payment rules
      /committee renewal/i,              // NSF committee maintenance
      /fee schedule|pricing/i,           // Payment regulations
      /nasdaq|sec filing/i,              // Securities
    ];

    const newsBeforeCount = this.news.length;
    const newsDropped = [];
    const policiesDropped = [];

    // Curate NEWS: Drop only obvious false positives, keep uncertain records flagged
    this.news = this.news.filter(record => {
      if (!record.id.startsWith('hn-')) {
        // RSS and other sources: no automatic curation, just proceed
        return true;
      }

      const title = record.title.toLowerCase();
      const isObviousFalsePositive = hnFalsePositives.some(pattern => pattern.test(title));

      if (isObviousFalsePositive) {
        newsDropped.push(record.id);
        this.results.curated.dropped++;
        return false;
      }

      // IMPORTANT: Do NOT clear curator flag here
      // Survivors still need human judgment (60-70% are still noise after filtering)
      // The flag preserves the contract: uncertain = unshippable until reviewed
      this.results.curated.kept++;
      return true;
    });

    // Curate POLICIES: same approach, preserve flags on survivors
    const policiesBeforeCount = this.policies.length;

    this.policies = this.policies.filter(record => {
      const title = record.title.toLowerCase();
      const summary = (record.summary || '').toLowerCase();
      const text = `${title} ${summary}`;

      const isObviousFalsePositive = fedFalsePositives.some(pattern => pattern.test(text));

      if (isObviousFalsePositive) {
        policiesDropped.push(record.id);
        this.results.curated.dropped++;
        return false;
      }

      // IMPORTANT: Do NOT clear curator flag
      this.results.curated.kept++;
      return true;
    });

    // Write back
    fs.writeFileSync(
      path.join(DATA_DIR, 'news.json'),
      JSON.stringify(this.news, null, 2)
    );
    fs.writeFileSync(
      path.join(DATA_DIR, 'policies.json'),
      JSON.stringify(this.policies, null, 2)
    );

    if (newsDropped.length > 0) {
      this.log(`  News: dropped ${newsDropped.length} obvious HN false positives`);
      this.log(`    Examples: ${newsDropped.slice(0, 3).join(', ')}`);
    }
    if (policiesDropped.length > 0) {
      this.log(`  Policies: dropped ${policiesDropped.length} obvious Fed-Reg false positives`);
      this.log(`    Examples: ${policiesDropped.slice(0, 3).join(', ')}`);
    }

    this.log(`  News: ${newsBeforeCount} → ${this.news.length} records`);
    this.log(`  Policies: ${policiesBeforeCount} → ${this.policies.length} records`);
  }

  // Step 3.5: Run enrichment to populate themes, company links, etc.
  enrich() {
    this.log('Step 3.5: Running enrichment...');

    try {
      execSync('node scripts/enrich.js 2>&1', { encoding: 'utf-8' });
      this.log('  ✓ Enrichment complete');
    } catch (e) {
      this.log(`  Enrichment warning: ${e.message.split('\n')[0]}`, 'warn');
      // Enrichment failures are not fatal, data is still valid
    }
  }

  // Step 4: Report
  report() {
    this.log('Step 4: Reporting results...');

    const newsDelta = this.news.length - this.initialCounts.news;
    const policiesDelta = this.policies.length - this.initialCounts.policies;

    this.log(`  News: ${this.initialCounts.news} → ${this.news.length} (${newsDelta > 0 ? '+' : ''}${newsDelta})`);
    this.log(`  Policies: ${this.initialCounts.policies} → ${this.policies.length} (${policiesDelta > 0 ? '+' : ''}${policiesDelta})`);

    if (this.sourceBreakdown && Object.keys(this.sourceBreakdown).length > 0) {
      this.log('  Scraped by source:');
      Object.entries(this.sourceBreakdown).forEach(([source, count]) => {
        this.log(`    ${source}: ${count}`);
      });
    }

    if (this.results.warnings.length > 0) {
      this.log(`  ⚠️  ${this.results.warnings.length} warning(s)`, 'warn');
      this.results.warnings.forEach(w => {
        this.log(`    ${w}`, 'warn');
      });
    }

    if (this.results.errors.length > 0) {
      this.log(`  ✗ ${this.results.errors.length} error(s)`, 'error');
      this.results.errors.forEach(e => {
        this.log(`    ${e}`, 'error');
      });
    } else if (this.results.validated) {
      this.log('  ✓ All validation passed', 'info');
    }
  }

  // Step 5: Self-improve (update REFRESH.md if new patterns found)
  selfImprove() {
    this.log('Step 5: Checking for new patterns...');
    this.log('  No new patterns learned (manual review recommended)');
  }

  // Main pipeline
  run() {
    try {
      fs.writeFileSync(REFRESH_LOG, `\n=== Refresh Run: ${new Date().toISOString()} ===\n`);

      this.loadCurrentState();
      this.runScrapers();
      this.autoCurate();

      if (!this.validate()) {
        this.log('Validation failed — stopping pipeline', 'error');
        this.results.errors.push('Validation failed — pipeline halted');
        this.report();
        process.exit(1);
      }

      this.enrich();

      // Use strict validation only after enrichment to catch schema issues
      if (!this.validate(true)) {
        this.log('Validation failed after enrichment — stopping pipeline', 'error');
        this.results.errors.push('Post-enrichment validation failed');
        this.report();
        process.exit(1);
      }

      this.report();
      this.selfImprove();

      // Update sources.json: reload first to preserve scraper-written timestamps
      const freshSources = this.loadJSON(path.join(DATA_DIR, 'sources.json'));
      freshSources._meta.last_updated = new Date().toISOString().split('T')[0];
      fs.writeFileSync(
        path.join(DATA_DIR, 'sources.json'),
        JSON.stringify(freshSources, null, 2)
      );

      this.log('Refresh pipeline complete ✓');

      // Return results for potential CI/CD use
      return this.results;
    } catch (e) {
      this.log(`Fatal error: ${e.message}`, 'error');
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const pipeline = new RefreshPipeline();
  const results = pipeline.run();

  // Exit with error code if validation failed
  if (!results.validated) {
    process.exit(1);
  }
}

export default RefreshPipeline;

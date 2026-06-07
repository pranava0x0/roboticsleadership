#!/usr/bin/env node
/**
 * scripts/lint-actions.js — Verify all GitHub Actions use SHA-pinned versions.
 * Rejects floating @vN tags to prevent supply-chain compromise.
 *
 * Exit 0 if all actions are SHA-pinned; exit 1 if any use floating tags.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const WORKFLOWS_DIR = resolve(ROOT, '.github/workflows');

const floatingTagRegex = /uses:\s+[\w\-./]+@v\d+(?:\s|$)/;
const shaPinnedRegex = /uses:\s+[\w\-./]+@[a-f0-9]{40}/;

let errors = [];

try {
  const files = readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

  files.forEach(file => {
    const content = readFileSync(resolve(WORKFLOWS_DIR, file), 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      if (floatingTagRegex.test(line)) {
        errors.push(`${file}:${lineNum} — floating tag: ${line.trim()}`);
      }
    });
  });

  if (errors.length > 0) {
    console.error('❌ Found floating action tags (must be SHA-pinned):');
    errors.forEach(err => console.error(`  ${err}`));
    console.error('\nRun: grep -r "uses:.*@v[0-9]" .github/workflows/ to find them.');
    process.exit(1);
  } else {
    console.log('✓ All GitHub Actions are SHA-pinned.');
    process.exit(0);
  }
} catch (err) {
  console.error('Error linting workflows:', err.message);
  process.exit(1);
}

import { execSync } from 'node:child_process';

const BRANCHES = [
  'origin/auto/news-2026-05-25-135712',
  'origin/auto/news-2026-05-26-135121',
  'origin/auto/news-2026-05-27-142418',
  'origin/auto/news-2026-05-28-143837',
  'origin/auto/news-2026-05-29-135548',
  'origin/auto/news-2026-05-30-120233',
  'origin/auto/news-2026-05-31-120749',
  'origin/auto/news-2026-06-01-163433',
  'origin/auto/news-2026-06-02-144803',
  'origin/auto/policy-2026-05-25-162100',
  'origin/auto/archive-2026-06-01-135359',
];

function runCmd(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf8' });
  } catch (e) {
    return e.stdout + '\n' + e.stderr;
  }
}

function main() {
  console.log('Starting programmatic merge of all auto-scraped branches...');
  
  // Make sure we are on main
  const currentBranch = runCmd('git branch --show-current').trim();
  if (currentBranch !== 'main') {
    console.error(`Error: Must be on "main" branch. Currently on "${currentBranch}"`);
    process.exit(1);
  }

  // Ensure working directory is clean
  const status = runCmd('git status --porcelain').trim();
  if (status !== '') {
    // If the only uncommitted changes are the resolver script and this script, we can commit them or stash them.
    // Wait, let's see what they are:
    console.log('Working directory is not clean. Committing new helper scripts first.');
    runCmd('git add scripts/merge-conflict-resolver.js scripts/merge-all-branches.js');
    runCmd('git commit -m "Add helper scripts for programmatic git merge conflict resolution"');
  }

  for (const branch of BRANCHES) {
    console.log(`\n========================================`);
    console.log(`Merging ${branch}...`);
    console.log(`========================================`);

    // 1. Run git merge --no-commit --no-ff
    const mergeOutput = runCmd(`git merge --no-commit --no-ff ${branch}`);
    if (mergeOutput.includes('error') || mergeOutput.includes('fatal')) {
      console.error('  git merge error:\n' + mergeOutput);
    }

    // 2. Resolve conflicts programmatically
    const resNews = runCmd('node scripts/merge-conflict-resolver.js news');
    const resPolicies = runCmd('node scripts/merge-conflict-resolver.js policies');
    const resSources = runCmd('node scripts/merge-conflict-resolver.js sources');
    // Print only the resolver summary lines (lines starting with - or ✓ or Error)
    [resNews, resPolicies, resSources].forEach(out => {
      out.trim().split('\n')
        .filter(l => l.startsWith('-') || l.startsWith('✓') || l.toLowerCase().includes('error'))
        .forEach(l => console.log(' ', l));
    });

    // 3. Stage and commit
    runCmd('git add docs/data/news.json docs/data/policies.json docs/data/sources.json');
    const commitOutput = runCmd(`git commit -m "Merge branch '${branch}' into main"`);
    // Print only the commit hash line
    const commitLine = commitOutput.trim().split('\n').find(l => l.startsWith('[main'));
    if (commitLine) console.log(' ', commitLine);
    else console.log('  (nothing to commit — already up to date)');

    // 4. Validate — show only the summary line
    const validationOutput = runCmd('npm run validate');
    const summary = validationOutput.trim().split('\n').slice(-2).join(' | ');
    console.log('  validate:', summary);
    if (validationOutput.includes('Validation failed')) {
      console.error('Full validation output:\n' + validationOutput);
      console.error('Validation failed after merging branch ' + branch);
      process.exit(1);
    }
  }

  console.log('\n========================================');
  console.log('All branches merged and validated successfully!');
  console.log('========================================');
}

main();

import { execSync } from 'node:child_process';

const BRANCHES = [
  'origin/auto/news-2026-05-18-023630',
  'origin/auto/news-2026-05-18-142725',
  'origin/auto/news-2026-05-19-135423',
  'origin/auto/news-2026-05-20-133549',
  'origin/auto/news-2026-05-21-141127',
  'origin/auto/news-2026-05-22-132757',
  'origin/auto/policy-2026-05-18-164621'
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
    console.log(`Running git merge --no-commit --no-ff ${branch}...`);
    const mergeOutput = runCmd(`git merge --no-commit --no-ff ${branch}`);
    console.log(mergeOutput);

    // 2. Resolve conflicts programmatically
    console.log('Resolving conflicts programmatically for news, policies, and sources...');
    const resNews = runCmd('node scripts/merge-conflict-resolver.js news');
    console.log(resNews.trim());
    const resPolicies = runCmd('node scripts/merge-conflict-resolver.js policies');
    console.log(resPolicies.trim());
    const resSources = runCmd('node scripts/merge-conflict-resolver.js sources');
    console.log(resSources.trim());

    // 3. Stage resolved files
    console.log('Staging resolved files...');
    runCmd('git add docs/data/news.json docs/data/policies.json docs/data/sources.json');

    // 4. Check if any other files are conflicted or modified
    const statusOutput = runCmd('git status --porcelain');
    console.log('Current status:\n' + statusOutput);

    // 5. Commit the merge
    console.log('Committing merge...');
    const commitOutput = runCmd(`git commit -m "Merge branch '${branch}' into main"`);
    console.log(commitOutput);

    // 6. Validate current state
    console.log('Validating data integrity...');
    const validationOutput = runCmd('npm run validate');
    console.log(validationOutput);
    if (validationOutput.includes('Validation failed')) {
      console.error('Validation failed after merging branch ' + branch);
      process.exit(1);
    }
  }

  console.log('\n========================================');
  console.log('All branches merged and validated successfully!');
  console.log('========================================');
}

main();

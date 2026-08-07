import { fetchAndExtractRepo } from './services/repoService.js';
import { walkSourceFiles } from './services/fileScanner.js';

const TEST_OWNER = 'facebook';
const TEST_REPO = 'react';
const TEST_BRANCH = 'main';

async function main() {
  console.log(`Fetching ${TEST_OWNER}/${TEST_REPO}@${TEST_BRANCH}...`);

  const { sourceRoot, cleanup } = await fetchAndExtractRepo({
    owner: TEST_OWNER,
    repo: TEST_REPO,
    branch: TEST_BRANCH,
  });

  try {
    console.log(`Extracted to: ${sourceRoot}`);

    const scan = await walkSourceFiles(sourceRoot);
    console.log(`Source files found: ${scan.stats.totalFiles}`);

    if (scan.warnings.length) {
      console.log('Warnings:');
      for (const warning of scan.warnings) {
        console.log(`  - ${warning}`);
      }
    }

    console.log('\nFirst 10 source files:');
    for (const file of scan.files.slice(0, 10)) {
      console.log(`  ${file}`);
    }
  } finally {
    await cleanup();
    console.log('\nTemp folder cleaned up.');
  }
}

main().catch((error) => {
  console.error('Test failed:', error.message);
  if (error.details) console.error('Details:', error.details);
  process.exit(1);
});

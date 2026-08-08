// Quick unit tests for the repo clone step completion
// Tests: size guard, INVALID_INPUT, secretScanner patterns, fileScanner wiring

import { fetchAndExtractRepo, RepoFetchError } from './services/repoService.js';
import { scanForSecrets } from './services/secretScanner.js';
import { walkSourceFiles } from './services/fileScanner.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Test 1 — size guard blocks download before touching the network
// ---------------------------------------------------------------------------
console.log('\n[1] repoService — size guard');
try {
  await fetchAndExtractRepo({
    owner: 'test', repo: 'test', branch: 'main',
    maxRepoSizeKb: 300 * 1024, // 300 MB > 200 MB limit
  });
  assert(false, 'should have thrown REPO_TOO_LARGE');
} catch (err) {
  assert(err instanceof RepoFetchError, 'throws RepoFetchError');
  assert(err.code === 'REPO_TOO_LARGE', 'code is REPO_TOO_LARGE');
  assert(err.statusCode === 422, 'statusCode is 422');
  assert(err.message.includes('200 MB'), 'message mentions the limit');
}

// ---------------------------------------------------------------------------
// Test 2 — missing required fields
// ---------------------------------------------------------------------------
console.log('\n[2] repoService — missing fields');
try {
  await fetchAndExtractRepo({ owner: '', repo: '', branch: '' });
  assert(false, 'should have thrown INVALID_INPUT');
} catch (err) {
  assert(err.code === 'INVALID_INPUT', 'throws INVALID_INPUT for empty fields');
}

// ---------------------------------------------------------------------------
// Test 3 — size below limit passes the guard (will fail at network later, not size)
// ---------------------------------------------------------------------------
console.log('\n[3] repoService — size within limit passes guard');
try {
  await fetchAndExtractRepo({
    owner: 'test', repo: 'test', branch: 'main',
    maxRepoSizeKb: 100 * 1024, // 100 MB — under limit
  });
  assert(false, 'should still fail at network');
} catch (err) {
  assert(err.code !== 'REPO_TOO_LARGE', 'size guard did NOT fire (correct)');
  assert(err.code === 'DOWNLOAD_ERROR' || err.code === 'DOWNLOAD_TIMEOUT' || err.code === 'REPO_NOT_FOUND', `failed at network stage with code: ${err.code}`);
}

// ---------------------------------------------------------------------------
// Test 4 — secretScanner detects patterns in a fake file
// ---------------------------------------------------------------------------
console.log('\n[4] secretScanner — pattern detection');
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'secret-test-'));

try {
  // Write a fake source file with a mix of secrets and innocent lines
  await fs.writeFile(path.join(tmpDir, 'config.js'), [
    '// config.js',
    'const DB_HOST = "localhost";',
    'const GITHUB_TOKEN = "ghp_abcdefghijklmnopqrstuvwxyz123456ABCD";',
    'const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";',
    'const api_key = "super-secret-api-key-value-here";',
    'module.exports = { DB_HOST };',
  ].join('\n'));

  const result = await scanForSecrets(tmpDir);

  assert(result.findings.length > 0, 'found at least one secret');
  assert(result.stats.scannedFiles >= 1, 'scanned at least 1 file');

  const ids = result.findings.map(f => f.patternId);
  assert(ids.includes('github_pat'), 'detected GitHub PAT');
  assert(ids.includes('aws_access_key_id'), 'detected AWS Access Key ID');
  assert(ids.includes('generic_api_key_assignment'), 'detected generic API key assignment');

  // Verify match values are redacted
  for (const finding of result.findings) {
    assert(finding.matchPreview.includes('***REDACTED***'), `finding for ${finding.patternId} is redacted`);
  }
} finally {
  await fs.rm(tmpDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Test 5 — secretScanner returns empty findings for a clean file
// ---------------------------------------------------------------------------
console.log('\n[5] secretScanner — no false positives on clean file');
const cleanDir = await fs.mkdtemp(path.join(os.tmpdir(), 'secret-clean-'));
try {
  await fs.writeFile(path.join(cleanDir, 'index.js'), [
    '// A totally clean file',
    'export function add(a, b) { return a + b; }',
    'const name = "hello world";',
  ].join('\n'));

  const result = await scanForSecrets(cleanDir);
  assert(result.findings.length === 0, 'no secrets found in clean file');
} finally {
  await fs.rm(cleanDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Test 6 — fileScanner (new repoWalker-based) walks a synthetic dir
// ---------------------------------------------------------------------------
console.log('\n[6] fileScanner — walkSourceFiles with repoWalker backend');
const repoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-walk-'));
try {
  await fs.mkdir(path.join(repoDir, 'src'));
  await fs.mkdir(path.join(repoDir, 'node_modules'));
  await fs.writeFile(path.join(repoDir, 'src', 'app.js'), 'console.log("hi");');
  await fs.writeFile(path.join(repoDir, 'src', 'util.ts'), 'export const x = 1;');
  await fs.writeFile(path.join(repoDir, 'node_modules', 'lodash.js'), '// should be ignored');
  await fs.writeFile(path.join(repoDir, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const result = await walkSourceFiles(repoDir);

  assert(result.files.length === 2, `found exactly 2 source files (got ${result.files.length})`);
  assert(result.files.every(f => !f.includes('node_modules')), 'node_modules excluded');
  assert(result.files.every(f => !f.endsWith('.png')), 'binary .png excluded');
  assert(result.stats.stoppedEarly === false, 'did not stop early');
} finally {
  await fs.rm(repoDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

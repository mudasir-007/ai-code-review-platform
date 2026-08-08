/**
 * kotlinLinter.js
 *
 * ktlint runner for Kotlin files.
 * Binary: ktlint  (brew install ktlint)
 */

import path from 'node:path';
import { safeExec, LINTER_TIMEOUT_MS, relPath } from './shared.js';
import { walkRepo } from '../../utils/repoWalker.js';

export const EXTENSIONS = ['.kt', '.kts'];
export const MANIFESTS = ['build.gradle.kts', 'build.gradle', 'settings.gradle.kts'];

/**
 * @param {string} repoRoot
 * @returns {Promise<import('../linterService.js').LintFileResult[]>}
 */
export async function run(repoRoot) {
  const files = await walkRepo(repoRoot, { extensions: EXTENSIONS });
  if (files.length === 0) return [];

  const absoluteFiles = files.map((f) => path.join(repoRoot, f));

  // ktlint exits 1 when violations found — JSON still in stdout
  const { stdout } = await safeExec(
    'ktlint',
    ['--reporter=json', ...absoluteFiles],
    { cwd: repoRoot, timeout: LINTER_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 },
  );

  if (!stdout.trim()) return [];

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }

  const results = [];
  for (const fileReport of (Array.isArray(parsed) ? parsed : [])) {
    if (!fileReport.errors || fileReport.errors.length === 0) continue;
    results.push({
      filePath: relPath(repoRoot, fileReport.file ?? ''),
      issues: fileReport.errors.map((e) => ({
        line: e.line ?? 1,
        column: e.col ?? 1,
        severity: 'warning',
        message: e.message ?? '',
        ruleId: `ktlint/${e.rule ?? 'unknown'}`,
        source: 'ktlint',
      })),
    });
  }

  return results;
}

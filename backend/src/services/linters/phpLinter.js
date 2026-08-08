/**
 * phpLinter.js
 *
 * PHP_CodeSniffer runner for PHP files.
 * Binary: phpcs  (composer global require squizlabs/php_codesniffer)
 */

import path from 'node:path';
import { safeExec, LINTER_TIMEOUT_MS, normalizeSeverity, relPath } from './shared.js';
import { walkRepo } from '../../utils/repoWalker.js';

export const EXTENSIONS = ['.php'];
export const MANIFESTS = ['composer.json', 'composer.lock'];

/**
 * @param {string} repoRoot
 * @returns {Promise<import('../linterService.js').LintFileResult[]>}
 */
export async function run(repoRoot) {
  // Use walkRepo to collect only project PHP files — this respects the standard
  // ignore list (vendor/, node_modules/, build/, etc.) so we never lint
  // third-party dependencies.
  const files = await walkRepo(repoRoot, { extensions: EXTENSIONS });
  if (files.length === 0) return [];

  const absoluteFiles = files.map((f) => path.join(repoRoot, f));

  // PSR-12 is the modern PHP coding standard; --report=json gives machine-readable output.
  // phpcs exits 1 when violations are found — safeExec absorbs the non-zero exit.
  const { stdout } = await safeExec(
    'phpcs',
    ['--report=json', '--standard=PSR12', ...absoluteFiles],
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
  for (const [filePath, fileData] of Object.entries(parsed.files ?? {})) {
    if (!fileData.messages || fileData.messages.length === 0) continue;
    results.push({
      filePath: relPath(repoRoot, filePath),
      issues: fileData.messages.map((m) => ({
        line: m.line ?? 1,
        column: m.column ?? 1,
        severity: normalizeSeverity(m.type?.toLowerCase()),
        message: m.message ?? '',
        ruleId: m.source ?? 'phpcs/unknown',
        source: 'phpcs',
      })),
    });
  }

  return results;
}

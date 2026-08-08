/**
 * phpLinter.js
 *
 * PHP_CodeSniffer runner for PHP files.
 * Binary: phpcs  (composer global require squizlabs/php_codesniffer)
 */

import { safeExec, LINTER_TIMEOUT_MS, normalizeSeverity, relPath } from './shared.js';

export const EXTENSIONS = ['.php'];
export const MANIFESTS = ['composer.json', 'composer.lock'];

/**
 * @param {string} repoRoot
 * @returns {Promise<import('../linterService.js').LintFileResult[]>}
 */
export async function run(repoRoot) {
  // PSR-12 is the modern PHP coding standard; --report=json gives machine-readable output
  const { stdout } = await safeExec(
    'phpcs',
    ['--report=json', '--standard=PSR12', '.'],
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

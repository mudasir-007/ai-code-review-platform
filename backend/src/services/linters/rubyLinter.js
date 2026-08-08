/**
 * rubyLinter.js
 *
 * RuboCop runner for Ruby files.
 * Binary: rubocop  (gem install rubocop)
 */

import { safeExec, LINTER_TIMEOUT_MS, normalizeSeverity, relPath } from './shared.js';

export const EXTENSIONS = ['.rb'];
export const MANIFESTS = ['Gemfile', '.rubocop.yml'];

/**
 * @param {string} repoRoot
 * @returns {Promise<import('../linterService.js').LintFileResult[]>}
 */
export async function run(repoRoot) {
  // safeExec rethrows ENOENT and captures stdout from both success and non-zero exits.
  // RuboCop exits 1 when offenses are found — stdout still contains valid JSON.
  const { stdout } = await safeExec(
    'rubocop',
    ['--format', 'json', '--no-color'],
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
  for (const file of (parsed.files ?? [])) {
    if (!file.offenses || file.offenses.length === 0) continue;
    results.push({
      filePath: relPath(repoRoot, file.path),
      issues: file.offenses.map((o) => ({
        line: o.location?.start_line ?? 1,
        column: o.location?.start_column ?? 1,
        severity: normalizeSeverity(o.severity),
        message: o.message ?? '',
        ruleId: o.cop_name ?? 'rubocop/unknown',
        source: 'rubocop',
      })),
    });
  }

  return results;
}

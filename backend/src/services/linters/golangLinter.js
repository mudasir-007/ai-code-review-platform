/**
 * golangLinter.js
 *
 * golangci-lint runner for Go files.
 * Binary: golangci-lint  (https://golangci-lint.run/usage/install/)
 */

import { safeExec, LINTER_TIMEOUT_MS, relPath } from './shared.js';

export const EXTENSIONS = ['.go'];
export const MANIFESTS = ['go.mod'];

/**
 * @param {string} repoRoot
 * @returns {Promise<import('../linterService.js').LintFileResult[]>}
 */
export async function run(repoRoot) {
  // --issues-exit-code=0 prevents non-zero exit when issues are found,
  // allowing us to always capture JSON output cleanly.
  const { stdout } = await safeExec(
    'golangci-lint',
    ['run', '--out-format=json', '--issues-exit-code=0'],
    { cwd: repoRoot, timeout: LINTER_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 },
  );

  if (!stdout.trim()) return [];

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }

  const results = new Map();
  for (const issue of (parsed.Issues ?? [])) {
    const fp = relPath(repoRoot, issue.Pos?.Filename ?? '');
    if (!fp) continue;

    const existing = results.get(fp) ?? { filePath: fp, issues: [] };
    existing.issues.push({
      line: issue.Pos?.Line ?? 1,
      column: issue.Pos?.Column ?? 1,
      severity: 'warning',
      message: issue.Text ?? '',
      ruleId: `golangci-lint/${issue.FromLinter ?? 'unknown'}`,
      source: 'golangci-lint',
    });
    results.set(fp, existing);
  }

  return [...results.values()];
}

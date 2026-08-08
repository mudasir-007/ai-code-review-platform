/**
 * shellLinter.js
 *
 * ShellCheck runner for shell script files.
 * Binary: shellcheck  (brew install shellcheck)
 */

import path from 'node:path';
import { safeExec, LINTER_TIMEOUT_MS, normalizeSeverity, relPath } from './shared.js';
import { walkRepo } from '../../utils/repoWalker.js';

export const EXTENSIONS = ['.sh', '.bash', '.zsh', '.ksh'];
export const MANIFESTS = [];

/**
 * @param {string} repoRoot
 * @returns {Promise<import('../linterService.js').LintFileResult[]>}
 */
export async function run(repoRoot) {
  const files = await walkRepo(repoRoot, { extensions: EXTENSIONS });
  if (files.length === 0) return [];

  const absoluteFiles = files.map((f) => path.join(repoRoot, f));

  // shellcheck exits 1 when issues found — JSON still in stdout
  const { stdout } = await safeExec(
    'shellcheck',
    ['--format=json', ...absoluteFiles],
    { cwd: repoRoot, timeout: LINTER_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 },
  );

  if (!stdout.trim()) return [];

  let items;
  try {
    items = JSON.parse(stdout);
  } catch {
    return [];
  }

  const results = new Map();
  for (const item of (Array.isArray(items) ? items : [])) {
    const fp = relPath(repoRoot, item.file ?? '');
    if (!fp) continue;

    const existing = results.get(fp) ?? { filePath: fp, issues: [] };
    existing.issues.push({
      line: item.line ?? 1,
      column: item.column ?? 1,
      severity: normalizeSeverity(item.level),
      message: item.message ?? '',
      ruleId: `shellcheck/SC${item.code ?? 0}`,
      source: 'shellcheck',
    });
    results.set(fp, existing);
  }

  return [...results.values()];
}

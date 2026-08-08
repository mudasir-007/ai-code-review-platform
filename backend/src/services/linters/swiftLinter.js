/**
 * swiftLinter.js
 *
 * SwiftLint runner for Swift files.
 * Binary: swiftlint  (brew install swiftlint)
 */

import { safeExec, LINTER_TIMEOUT_MS, normalizeSeverity, relPath } from './shared.js';

export const EXTENSIONS = ['.swift'];
export const MANIFESTS = ['Package.swift', '.swiftlint.yml'];

/**
 * @param {string} repoRoot
 * @returns {Promise<import('../linterService.js').LintFileResult[]>}
 */
export async function run(repoRoot) {
  // SwiftLint exits 2 when violations found — JSON still in stdout
  const { stdout } = await safeExec(
    'swiftlint',
    ['lint', '--reporter', 'json', '--quiet'],
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
      column: item.character ?? 1,
      severity: normalizeSeverity(item.severity),
      message: item.reason ?? '',
      ruleId: `swiftlint/${item.rule_id ?? 'unknown'}`,
      source: 'swiftlint',
    });
    results.set(fp, existing);
  }

  return [...results.values()];
}

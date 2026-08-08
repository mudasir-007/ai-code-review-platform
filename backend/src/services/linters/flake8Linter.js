/**
 * flake8Linter.js
 *
 * Flake8 runner for Python files.
 */

import path from 'node:path';
import { safeExec, LINTER_TIMEOUT_MS, relPath } from './shared.js';
import { walkRepo } from '../../utils/repoWalker.js';

export const EXTENSIONS = ['.py'];
export const MANIFESTS = ['pyproject.toml', 'requirements.txt', 'setup.py'];

const FLAKE8_LINE_REGEX = /^(.+?):(\d+):(\d+):\s+([A-Z]\d+)\s+(.+)$/;

function normalizeFlake8Output(stdout, repoRoot) {
  const results = new Map();

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(FLAKE8_LINE_REGEX);
    if (!match) continue;

    const [, filePath, lineNumber, column, ruleId, message] = match;
    const normalizedPath = relPath(repoRoot, filePath).replace(/^\.\//, '');

    const existing = results.get(normalizedPath) ?? { filePath: normalizedPath, issues: [] };
    existing.issues.push({
      line: Number.parseInt(lineNumber, 10),
      column: Number.parseInt(column, 10),
      severity: 'warning',
      message,
      ruleId,
      source: 'flake8',
    });
    results.set(normalizedPath, existing);
  }

  return [...results.values()];
}

/**
 * @param {string} repoRoot
 * @returns {Promise<import('../linterService.js').LintFileResult[]>}
 */
export async function run(repoRoot) {
  const files = await walkRepo(repoRoot, { extensions: EXTENSIONS });
  if (files.length === 0) return [];

  const absoluteFiles = files.map((file) => path.join(repoRoot, file));
  // flake8 exits 1 whenever it finds any violation — safeExec absorbs the
  // non-zero exit code and still returns stdout so we can parse the results.
  const { stdout } = await safeExec(
    'flake8',
    [...absoluteFiles, '--format=default'],
    {
      cwd: repoRoot,
      timeout: LINTER_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  return normalizeFlake8Output(stdout, repoRoot);
}

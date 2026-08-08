/**
 * sqlLinter.js
 *
 * SQLFluff runner for SQL and PostgreSQL files.
 * Binary: sqlfluff  (pip install sqlfluff)
 *
 * Dialect auto-detection:
 *  - .psql extension or pg/psycopg in deps → 'postgres'
 *  - Otherwise → 'ansi' (generic SQL)
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { safeExec, LINTER_TIMEOUT_MS, relPath } from './shared.js';
import { walkRepo } from '../../utils/repoWalker.js';

export const EXTENSIONS = ['.sql', '.psql', '.ddl'];
export const MANIFESTS = [];

async function detectDialect(repoRoot) {
  // Check package.json for PostgreSQL client libraries
  try {
    const pkgJson = JSON.parse(
      await fs.readFile(path.join(repoRoot, 'package.json'), 'utf8'),
    );
    const allDeps = { ...(pkgJson.dependencies ?? {}), ...(pkgJson.devDependencies ?? {}) };
    if ('pg' in allDeps || 'pg-promise' in allDeps || 'postgres' in allDeps || 'pgp' in allDeps) {
      return 'postgres';
    }
  } catch { /* no package.json */ }

  // Check Python requirements for psycopg (PostgreSQL adapter)
  try {
    const req = await fs.readFile(path.join(repoRoot, 'requirements.txt'), 'utf8');
    if (/psycopg|asyncpg|aiopg/.test(req)) return 'postgres';
  } catch { /* no requirements.txt */ }

  // .psql files are PostgreSQL-specific by convention
  const psqlFiles = await walkRepo(repoRoot, { extensions: ['.psql'] });
  if (psqlFiles.length > 0) return 'postgres';

  return 'ansi';
}

/**
 * @param {string} repoRoot
 * @returns {Promise<import('../linterService.js').LintFileResult[]>}
 */
export async function run(repoRoot) {
  const files = await walkRepo(repoRoot, { extensions: EXTENSIONS });
  if (files.length === 0) return [];

  const dialect = await detectDialect(repoRoot);

  // sqlfluff exits 1 when violations found — JSON still in stdout
  const { stdout } = await safeExec(
    'sqlfluff',
    ['lint', '--format=json', `--dialect=${dialect}`, '.'],
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
    if (!fileReport.violations || fileReport.violations.length === 0) continue;
    results.push({
      filePath: relPath(repoRoot, fileReport.filepath ?? ''),
      issues: fileReport.violations.map((v) => ({
        line: v.line_no ?? 1,
        column: v.line_pos ?? 1,
        severity: 'warning',
        message: v.description ?? '',
        ruleId: `sqlfluff/${v.code ?? 'unknown'}`,
        source: 'sqlfluff',
      })),
    });
  }

  return results;
}

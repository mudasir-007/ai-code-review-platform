/**
 * shared.js
 *
 * Common helpers shared across all linter modules.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

export const execFileAsync = promisify(execFile);
export const LINTER_TIMEOUT_MS = 120_000;

/**
 * Normalizes a raw severity value from any linter into 'error' | 'warning' | 'info'.
 * @param {unknown} value
 * @returns {'error' | 'warning' | 'info'}
 */
export function normalizeSeverity(value) {
  const v = typeof value === 'string' ? value.toLowerCase() : value;
  if (v === 2 || v === 'error' || v === 'e' || v === 'critical' || v === 'fatal') return 'error';
  if (v === 1 || v === 'warning' || v === 'warn' || v === 'w' || v === 'style' || v === 'performance' || v === 'portability') return 'warning';
  return 'info';
}

/**
 * Converts a filePath to a repo-relative path.
 * ESLint (and some other tools) return absolute paths; this ensures consistency.
 * @param {string} repoRoot
 * @param {string} filePath
 * @returns {string}
 */
export function relPath(repoRoot, filePath) {
  if (!filePath) return filePath;
  return path.isAbsolute(filePath) ? path.relative(repoRoot, filePath) : filePath;
}

/**
 * Runs a CLI tool and always returns { stdout, stderr }, whether the process
 * succeeded or exited with a non-zero code (many linters exit 1 when they find
 * issues). Re-throws ENOENT so runIsolatedLinter() can tag it as
 * 'binary_not_found'.
 *
 * This eliminates the `let stdout = ''` reassignment anti-pattern across
 * all linter modules and fixes TypeScript strict-mode errors on `err.stdout`.
 *
 * @param {string} binary
 * @param {string[]} args
 * @param {import('node:child_process').ExecFileOptions} options
 * @returns {Promise<{ stdout: string; stderr: string }>}
 */
export async function safeExec(binary, args, options) {
  try {
    const { stdout, stderr } = await execFileAsync(binary, args, options);
    return { stdout: stdout ?? '', stderr: stderr ?? '' };
  } catch (err) {
    // err is `unknown` in TS strict mode — narrow it before accessing properties
    const nodeErr = /** @type {NodeJS.ErrnoException & { stdout?: string; stderr?: string }} */ (err);
    if (nodeErr.code === 'ENOENT') throw nodeErr; // binary not installed
    return {
      stdout: nodeErr.stdout ?? '',
      stderr: nodeErr.stderr ?? '',
    };
  }
}

/**
 * fileScanner.js
 *
 * Thin wrapper around repoWalker that collects all scannable source files
 * from an extracted repository root.
 *
 * Previously this module contained its own directory-walk implementation.
 * That logic has been retired in favour of repoWalker.js, which has a more
 * complete ignore list, configurable depth/file caps, and no depth-exceeded
 * recursion bug.
 */

import path from 'node:path';
import { walkRepo } from '../utils/repoWalker.js';

// ---------------------------------------------------------------------------
// Scannable file extensions — everything a code-review tool cares about
// ---------------------------------------------------------------------------

const SOURCE_EXTENSIONS = new Set([
  // JavaScript / TypeScript
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
  // Python
  '.py',
  // Rust
  '.rs',
  // Go
  '.go',
  // JVM
  '.java', '.kt', '.kts', '.scala',
  // C / C++
  '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp',
  // Web
  '.vue', '.svelte',
  // Ruby / PHP / C#
  '.rb', '.php', '.cs',
  // Shell
  '.sh', '.bash', '.zsh',
  // Mobile
  '.swift', '.dart',
  // Data / Config (still useful for AI review)
  '.sql', '.lua', '.r',
  '.yaml', '.yml', '.toml', '.json', '.md',
]);

/** Hard cap on files returned — guards against enormous monorepos. */
const MAX_FILES = 5_000;

/** Hard cap on directory depth — prevents runaway traversal. */
const MAX_DEPTH = 20;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Recursively walks an extracted repository source root and returns all
 * scannable source file paths (relative to `sourceRoot`).
 *
 * Respects the canonical ignore list from repoWalker (node_modules, .git,
 * dist, build, __pycache__, .venv, target, vendor, etc.).
 *
 * @param {string} sourceRoot - Absolute path to the extracted repo root
 * @returns {Promise<{
 *   files: string[],
 *   warnings: string[],
 *   stats: { totalFiles: number, stoppedEarly: boolean, maxFiles: number, maxDepth: number }
 * }>}
 */
export async function walkSourceFiles(sourceRoot) {
  const warnings = [];

  const files = await walkRepo(sourceRoot, {
    maxDepth: MAX_DEPTH,
    maxFiles: MAX_FILES,
    extensions: [...SOURCE_EXTENSIONS],
  });

  const stoppedEarly = files.length >= MAX_FILES;

  if (stoppedEarly) {
    warnings.push(
      `File count reached the cap of ${MAX_FILES}. Scan stopped early — ` +
      'some files may not have been reviewed.',
    );
  }

  return {
    files,
    warnings,
    stats: {
      totalFiles: files.length,
      stoppedEarly,
      maxFiles: MAX_FILES,
      maxDepth: MAX_DEPTH,
    },
  };
}

/**
 * Helper to get the relative path of a file from the source root.
 * Convenience re-export for callers that previously used fileScanner directly.
 */
export function getRelativePath(sourceRoot, absoluteFilePath) {
  return path.relative(sourceRoot, absoluteFilePath);
}

import fs from 'node:fs/promises';
import path from 'node:path';

/** Directory names skipped during repo traversal (noise / deps / build output). */
export const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'target',
  '__pycache__',
  '.venv',
  'venv',
  '.pytest_cache',
  'coverage',
  '.next',
  '.nuxt',
  '.cache',
  '.turbo',
  '.idea',
  '.vscode',
  'vendor',
  'tmp',
  'temp',
]);

/** Skip hidden directories (names starting with ".") except none by default. */
export const SKIP_HIDDEN_DIRECTORIES = true;

/** Max directory depth from repo root (prevents runaway traversal). */
export const DEFAULT_MAX_DEPTH = 20;

/** Max files collected per walk (safety cap). */
export const DEFAULT_MAX_FILES = 5000;

const DEFAULT_IGNORED_EXTENSIONS = new Set([
  '.min.js',
  '.min.css',
  '.map',
  '.lock',
]);

/**
 * Returns true when a directory entry should be skipped.
 */
export function shouldSkipDirectory(dirName, { skipHidden = SKIP_HIDDEN_DIRECTORIES } = {}) {
  if (!dirName) return true;
  if (IGNORED_DIR_NAMES.has(dirName)) return true;
  if (skipHidden && dirName.startsWith('.')) return true;
  return false;
}

/**
 * Returns true when a file should be skipped.
 */
export function shouldSkipFile(fileName) {
  if (!fileName || fileName.startsWith('.')) return true;

  for (const ext of DEFAULT_IGNORED_EXTENSIONS) {
    if (fileName.endsWith(ext)) return true;
  }

  return false;
}

/**
 * Walks a repo root and returns relative file paths, honoring ignore rules.
 */
export async function walkRepo(
  repoRoot,
  {
    maxDepth = DEFAULT_MAX_DEPTH,
    maxFiles = DEFAULT_MAX_FILES,
    extensions = null,
    skipHidden = SKIP_HIDDEN_DIRECTORIES,
  } = {},
) {
  const files = [];
  const extensionSet = extensions ? new Set(extensions.map((ext) => ext.toLowerCase())) : null;

  async function visit(currentDir, depth) {
    if (files.length >= maxFiles) return;
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) break;

      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name, { skipHidden })) continue;
        await visit(absolutePath, depth + 1);
        continue;
      }

      if (!entry.isFile()) continue;
      if (shouldSkipFile(entry.name)) continue;

      if (extensionSet) {
        const fileExt = path.extname(entry.name).toLowerCase();
        if (!extensionSet.has(fileExt)) continue;
      }

      files.push(path.relative(repoRoot, absolutePath));
    }
  }

  await visit(repoRoot, 0);
  return files;
}

/**
 * Finds directories that contain a given manifest filename (e.g. Cargo.toml).
 */
export async function findManifestDirectories(repoRoot, manifestName) {
  const matches = [];

  async function visit(currentDir, depth) {
    if (depth > DEFAULT_MAX_DEPTH) return;

    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (shouldSkipDirectory(entry.name)) continue;

      const absolutePath = path.join(currentDir, entry.name);
      const manifestPath = path.join(absolutePath, manifestName);

      try {
        const stat = await fs.stat(manifestPath);
        if (stat.isFile()) {
          matches.push(absolutePath);
        }
      } catch {
        // Manifest not present in this directory.
      }

      await visit(absolutePath, depth + 1);
    }
  }

  const rootManifest = path.join(repoRoot, manifestName);
  try {
    const stat = await fs.stat(rootManifest);
    if (stat.isFile()) matches.push(repoRoot);
  } catch {
    // No root manifest.
  }

  await visit(repoRoot, 0);
  return [...new Set(matches)];
}

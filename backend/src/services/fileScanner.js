import fs from 'node:fs/promises';
import path from 'node:path';

const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '__pycache__',
  'vendor',
  '.next',
]);

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.bmp',
  '.svg',
  '.pdf',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.zip',
  '.tar',
  '.gz',
  '.7z',
  '.rar',
  '.mp3',
  '.mp4',
  '.wav',
  '.avi',
  '.mov',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
]);

const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.kt',
  '.kts',
  '.rb',
  '.php',
  '.cs',
  '.cpp',
  '.cc',
  '.cxx',
  '.c',
  '.h',
  '.hpp',
  '.swift',
  '.scala',
  '.sh',
  '.bash',
  '.zsh',
  '.sql',
  '.vue',
  '.svelte',
  '.lua',
  '.r',
  '.dart',
  '.yaml',
  '.yml',
  '.toml',
  '.json',
  '.md',
]);

const MAX_FILES = 1000;
const MAX_DEPTH = 10;

function isBinaryFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

function isSourceFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return SOURCE_EXTENSIONS.has(ext);
}

/**
 * Recursively walks extracted source and returns relative source file paths.
 */
export async function walkSourceFiles(sourceRoot) {
  const files = [];
  const warnings = [];
  let stoppedEarly = false;

  async function visit(currentDir, depth) {
    if (stoppedEarly) return;

    if (depth > MAX_DEPTH) {
      warnings.push(`Directory depth exceeded ${MAX_DEPTH} at: ${path.relative(sourceRoot, currentDir) || '.'}`);
    }

    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (stoppedEarly) break;

      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
        await visit(absolutePath, depth + 1);
        continue;
      }

      if (!entry.isFile()) continue;
      if (isBinaryFile(entry.name)) continue;
      if (!isSourceFile(entry.name)) continue;

      files.push(path.relative(sourceRoot, absolutePath));

      if (files.length >= MAX_FILES) {
        warnings.push(`File count exceeded ${MAX_FILES}. Scan stopped early.`);
        stoppedEarly = true;
        break;
      }
    }
  }

  await visit(sourceRoot, 0);

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

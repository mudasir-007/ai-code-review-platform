import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import { ESLint } from 'eslint';
import js from '@eslint/js';
import { findManifestDirectories, walkRepo } from '../utils/repoWalker.js';

const execFileAsync = promisify(execFile);

const JS_EXTENSIONS = ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'];
const PYTHON_EXTENSIONS = ['.py'];
const RUST_EXTENSIONS = ['.rs'];

const JS_GLOBS = ['**/*.{js,mjs,cjs,jsx,ts,tsx}'];
const LINTER_TIMEOUT_MS = 120_000;

/**
 * @typedef {'error' | 'warning' | 'info'} IssueSeverity
 */

/**
 * @typedef {Object} LintIssue
 * @property {number} line
 * @property {number} column
 * @property {IssueSeverity} severity
 * @property {string} message
 * @property {string} ruleId
 * @property {'eslint' | 'flake8' | 'clippy'} source
 */

/**
 * @typedef {Object} LintFileResult
 * @property {string} filePath
 * @property {LintIssue[]} issues
 */

/**
 * @typedef {Object} LinterRunResult
 * @property {'eslint' | 'flake8' | 'clippy'} linter
 * @property {'success' | 'failed' | 'skipped'} status
 * @property {LintFileResult[]} results
 * @property {string | null} error
 */

/**
 * @typedef {Object} RunLintersResponse
 * @property {LintFileResult[]} results
 * @property {LinterRunResult[]} runs
 * @property {{ languages: string[], fileCounts: Record<string, number> }} detection
 */

function normalizeSeverity(value) {
  if (value === 2 || value === '2' || value === 'error') return 'error';
  if (value === 1 || value === '1' || value === 'warning') return 'warning';
  return 'info';
}

function mergeResultsByFile(results) {
  const merged = new Map();

  for (const fileResult of results) {
    const existing = merged.get(fileResult.filePath) ?? {
      filePath: fileResult.filePath,
      issues: [],
    };

    existing.issues.push(...fileResult.issues);
    merged.set(fileResult.filePath, existing);
  }

  return [...merged.values()];
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function countFilesByExtension(repoRoot, extensions) {
  const files = await walkRepo(repoRoot, { extensions });
  const counts = Object.fromEntries(extensions.map((ext) => [ext, 0]));

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (counts[ext] !== undefined) counts[ext] += 1;
  }

  return { files, counts };
}

/**
 * Detects likely languages present in a repository.
 */
export async function detectLanguages(repoRoot) {
  const languages = new Set();
  const fileCounts = {};

  const [{ files: jsFiles, counts: jsCounts }, pythonWalk, rustWalk] = await Promise.all([
    countFilesByExtension(repoRoot, JS_EXTENSIONS),
    countFilesByExtension(repoRoot, PYTHON_EXTENSIONS),
    countFilesByExtension(repoRoot, RUST_EXTENSIONS),
  ]);

  Object.assign(fileCounts, jsCounts, pythonWalk.counts, rustWalk.counts);

  const hasPackageJson = await pathExists(path.join(repoRoot, 'package.json'));
  const hasPyProject = await pathExists(path.join(repoRoot, 'pyproject.toml'));
  const hasRequirements = await pathExists(path.join(repoRoot, 'requirements.txt'));
  const hasCargoToml = (await findManifestDirectories(repoRoot, 'Cargo.toml')).length > 0;

  if (jsFiles.length > 0 || hasPackageJson) languages.add('javascript');
  if (pythonWalk.files.length > 0 || hasPyProject || hasRequirements) languages.add('python');
  if (rustWalk.files.length > 0 || hasCargoToml) languages.add('rust');

  return {
    languages: [...languages],
    fileCounts,
  };
}

async function buildEslintInstance(repoRoot) {
  const config = [
    {
      ignores: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**',
        '**/target/**',
      ],
    },
    js.configs.recommended,
    {
      files: ['**/*.{js,mjs,cjs,jsx}'],
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  ];

  try {
    const tseslint = await import('typescript-eslint');
    config.push(...tseslint.configs.recommended);
  } catch {
    // TypeScript linting falls back to JS-only when typescript-eslint is unavailable.
  }

  return new ESLint({
    cwd: repoRoot,
    overrideConfig: config,
    errorOnUnmatchedPattern: false,
  });
}

function normalizeEslintResults(eslintResults) {
  return eslintResults
    .filter((result) => result.messages.length > 0)
    .map((result) => ({
      filePath: result.filePath,
      issues: result.messages.map((message) => ({
        line: message.line ?? 1,
        column: message.column ?? 1,
        severity: normalizeSeverity(message.severity),
        message: message.message,
        ruleId: message.ruleId ?? 'eslint/unknown',
        source: 'eslint',
      })),
    }));
}

async function runEslint(repoRoot) {
  const eslint = await buildEslintInstance(repoRoot);
  const eslintResults = await eslint.lintFiles(JS_GLOBS);
  return normalizeEslintResults(eslintResults);
}

const FLAKE8_LINE_REGEX = /^(.+?):(\d+):(\d+):\s+([A-Z]\d+)\s+(.+)$/;

function normalizeFlake8Output(stdout, repoRoot) {
  const results = new Map();

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(FLAKE8_LINE_REGEX);
    if (!match) continue;

    const [, filePath, lineNumber, column, ruleId, message] = match;
    const normalizedPath = path.isAbsolute(filePath)
      ? path.relative(repoRoot, filePath)
      : filePath.replace(/^\.\//, '');

    const existing = results.get(normalizedPath) ?? {
      filePath: normalizedPath,
      issues: [],
    };

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

async function runFlake8(repoRoot) {
  const { files } = await countFilesByExtension(repoRoot, PYTHON_EXTENSIONS);
  if (files.length === 0) return [];

  const absoluteFiles = files.map((file) => path.join(repoRoot, file));
  const { stdout } = await execFileAsync(
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

function normalizeClippyMessages(messages, repoRoot) {
  const results = new Map();

  for (const entry of messages) {
    if (entry.reason !== 'compiler-message') continue;

    const payload = entry.message;
    if (!payload || !Array.isArray(payload.spans) || payload.spans.length === 0) continue;

    const primarySpan = payload.spans.find((span) => span.is_primary) ?? payload.spans[0];
    const absoluteFile = primarySpan.file_name;
    const filePath = path.isAbsolute(absoluteFile)
      ? path.relative(repoRoot, absoluteFile)
      : absoluteFile;

    const existing = results.get(filePath) ?? {
      filePath,
      issues: [],
    };

    existing.issues.push({
      line: primarySpan.line_start ?? 1,
      column: primarySpan.column_start ?? 1,
      severity: normalizeSeverity(payload.level),
      message: payload.message,
      ruleId: payload.code?.code ?? 'clippy/unknown',
      source: 'clippy',
    });

    results.set(filePath, existing);
  }

  return [...results.values()];
}

async function runClippyInProject(projectRoot, repoRoot) {
  const { stdout } = await execFileAsync(
    'cargo',
    ['clippy', '--message-format=json', '--quiet'],
    {
      cwd: projectRoot,
      timeout: LINTER_TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  const messages = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return normalizeClippyMessages(messages, repoRoot);
}

async function runClippy(repoRoot) {
  const cargoRoots = await findManifestDirectories(repoRoot, 'Cargo.toml');
  if (cargoRoots.length === 0) return [];

  const allResults = [];
  for (const cargoRoot of cargoRoots) {
    const projectResults = await runClippyInProject(cargoRoot, repoRoot);
    allResults.push(...projectResults);
  }

  return mergeResultsByFile(allResults);
}

async function runIsolatedLinter(linter, runner) {
  try {
    const results = await runner();
    return {
      linter,
      status: 'success',
      results,
      error: null,
    };
  } catch (error) {
    return {
      linter,
      status: 'failed',
      results: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Runs all applicable linters with fault isolation and returns unified results.
 */
export async function runLinters(
  repoRoot,
  {
    languages = null,
    runJavaScript = true,
    runPython = true,
    runRust = true,
  } = {},
) {
  const absoluteRepoRoot = path.resolve(repoRoot);
  const repoStat = await fs.stat(absoluteRepoRoot).catch(() => null);
  if (!repoStat?.isDirectory()) {
    throw new Error(`Repository path is not a directory: ${repoRoot}`);
  }

  const detection = await detectLanguages(absoluteRepoRoot);
  const selectedLanguages = languages ?? detection.languages;

  const tasks = [];

  if (runJavaScript && selectedLanguages.includes('javascript')) {
    tasks.push(runIsolatedLinter('eslint', () => runEslint(absoluteRepoRoot)));
  }

  if (runPython && selectedLanguages.includes('python')) {
    tasks.push(runIsolatedLinter('flake8', () => runFlake8(absoluteRepoRoot)));
  }

  if (runRust && selectedLanguages.includes('rust')) {
    tasks.push(runIsolatedLinter('clippy', () => runClippy(absoluteRepoRoot)));
  }

  const runs = await Promise.all(tasks);
  const successfulResults = runs.flatMap((run) => run.results);

  return {
    results: mergeResultsByFile(successfulResults),
    runs,
    detection,
  };
}

export { JS_EXTENSIONS, PYTHON_EXTENSIONS, RUST_EXTENSIONS };

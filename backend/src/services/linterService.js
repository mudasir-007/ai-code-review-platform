/**
 * linterService.js
 *
 * Orchestrates all language linters: detects languages, runs applicable linters
 * in isolated try/catch blocks, and merges results into a unified output shape.
 *
 * Supported languages (14):
 *  JavaScript/TypeScript  → ESLint 10
 *  Python                 → Flake8
 *  Rust                   → Cargo Clippy
 *  Go                     → golangci-lint
 *  Java                   → Checkstyle (Google checks)
 *  Ruby                   → RuboCop
 *  PHP                    → PHP_CodeSniffer (PSR-12)
 *  C / C++                → Cppcheck
 *  Swift                  → SwiftLint
 *  Kotlin                 → ktlint
 *  Shell / Bash           → ShellCheck
 *  SQL / PostgreSQL        → SQLFluff (dialect auto-detected)
 *  MongoDB                → Built-in static analyzer (no binary needed)
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { findManifestDirectories, walkRepo } from '../utils/repoWalker.js';

// ─── Linter modules ───────────────────────────────────────────────────────────

import * as eslintLinter    from './linters/eslintLinter.js';
import * as flake8Linter    from './linters/flake8Linter.js';
import * as clippyLinter    from './linters/clippyLinter.js';
import * as golangLinter    from './linters/golangLinter.js';
import * as javaLinter      from './linters/javaLinter.js';
import * as rubyLinter      from './linters/rubyLinter.js';
import * as phpLinter       from './linters/phpLinter.js';
import * as cppLinter       from './linters/cppLinter.js';
import * as swiftLinter     from './linters/swiftLinter.js';
import * as kotlinLinter    from './linters/kotlinLinter.js';
import * as shellLinter     from './linters/shellLinter.js';
import * as sqlLinter       from './linters/sqlLinter.js';
import * as mongodbLinter   from './linters/mongodbLinter.js';

// ─── Extension constants (exported for consumers) ─────────────────────────────

export const JS_EXTENSIONS      = eslintLinter.EXTENSIONS;
export const PYTHON_EXTENSIONS  = flake8Linter.EXTENSIONS;
export const RUST_EXTENSIONS    = clippyLinter.EXTENSIONS;
export const GO_EXTENSIONS      = golangLinter.EXTENSIONS;
export const JAVA_EXTENSIONS    = javaLinter.EXTENSIONS;
export const RUBY_EXTENSIONS    = rubyLinter.EXTENSIONS;
export const PHP_EXTENSIONS     = phpLinter.EXTENSIONS;
export const CPP_EXTENSIONS     = cppLinter.EXTENSIONS;
export const SWIFT_EXTENSIONS   = swiftLinter.EXTENSIONS;
export const KOTLIN_EXTENSIONS  = kotlinLinter.EXTENSIONS;
export const SHELL_EXTENSIONS   = shellLinter.EXTENSIONS;
export const SQL_EXTENSIONS     = sqlLinter.EXTENSIONS;

// ─── Typedefs ─────────────────────────────────────────────────────────────────

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
 * @property {string} source  - e.g. 'eslint', 'flake8', 'clippy', 'rubocop', ...
 */

/**
 * @typedef {Object} LintFileResult
 * @property {string} filePath  - Repo-relative path
 * @property {LintIssue[]} issues
 */

/**
 * @typedef {Object} LinterRunResult
 * @property {string} linter   - Linter identifier (e.g. 'eslint', 'rubocop')
 * @property {'success' | 'failed' | 'skipped'} status
 * @property {LintFileResult[]} results
 * @property {string | null} error
 * @property {'binary_not_found' | 'runtime_error' | 'parse_error' | null} reason
 */

/**
 * @typedef {Object} RunLintersResponse
 * @property {LintFileResult[]} results
 * @property {LinterRunResult[]} runs
 * @property {{ languages: string[], fileCounts: Record<string, number> }} detection
 */

// ─── Linter registry ──────────────────────────────────────────────────────────

/**
 * Central registry mapping language → linter config.
 * Add new linters here; no changes needed in runLinters().
 *
 * @type {Array<{
 *   language: string,
 *   linterId: string,
 *   module: { run: (root: string) => Promise<LintFileResult[]>, EXTENSIONS: string[], MANIFESTS: string[] },
 *   flag: string,
 * }>}
 */
const LINTER_REGISTRY = [
  { language: 'javascript', linterId: 'eslint',            module: eslintLinter,   flag: 'runJavaScript' },
  { language: 'python',     linterId: 'flake8',            module: flake8Linter,   flag: 'runPython'     },
  { language: 'rust',       linterId: 'clippy',            module: clippyLinter,   flag: 'runRust'       },
  { language: 'go',         linterId: 'golangci-lint',     module: golangLinter,   flag: 'runGo'         },
  { language: 'java',       linterId: 'checkstyle',        module: javaLinter,     flag: 'runJava'       },
  { language: 'ruby',       linterId: 'rubocop',           module: rubyLinter,     flag: 'runRuby'       },
  { language: 'php',        linterId: 'phpcs',             module: phpLinter,      flag: 'runPhp'        },
  { language: 'cpp',        linterId: 'cppcheck',          module: cppLinter,      flag: 'runCpp'        },
  { language: 'swift',      linterId: 'swiftlint',         module: swiftLinter,    flag: 'runSwift'      },
  { language: 'kotlin',     linterId: 'ktlint',            module: kotlinLinter,   flag: 'runKotlin'     },
  { language: 'shell',      linterId: 'shellcheck',        module: shellLinter,    flag: 'runShell'      },
  { language: 'sql',        linterId: 'sqlfluff',          module: sqlLinter,      flag: 'runSql'        },
  { language: 'mongodb',    linterId: 'mongodb-analyzer',  module: mongodbLinter,  flag: 'runMongodb'    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mergeResultsByFile(results) {
  const merged = new Map();
  for (const fileResult of results) {
    const existing = merged.get(fileResult.filePath) ?? { filePath: fileResult.filePath, issues: [] };
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

// ─── Language detection ───────────────────────────────────────────────────────

/**
 * Detects which programming languages are present in a repository by
 * scanning file extensions and well-known manifest files.
 *
 * @param {string} repoRoot
 * @returns {Promise<{ languages: string[], fileCounts: Record<string, number> }>}
 */
export async function detectLanguages(repoRoot) {
  const languages = new Set();
  const fileCounts = {};

  // Walk all extension groups in parallel
  const allExtensions = LINTER_REGISTRY.flatMap((e) => e.module.EXTENSIONS);
  const uniqueExtensions = [...new Set(allExtensions)];

  const [{ files: allFiles, counts }] = await Promise.all([
    countFilesByExtension(repoRoot, uniqueExtensions),
  ]);
  Object.assign(fileCounts, counts);

  // Collect files per language by extension
  const filesByExt = new Map();
  for (const file of allFiles) {
    const ext = path.extname(file).toLowerCase();
    if (!filesByExt.has(ext)) filesByExt.set(ext, []);
    filesByExt.get(ext).push(file);
  }

  // Check manifest files for each linter in parallel
  const manifestChecks = await Promise.all(
    LINTER_REGISTRY.map(async ({ language, module }) => {
      const exts = module.EXTENSIONS;
      const hasFiles = exts.some((ext) => (filesByExt.get(ext)?.length ?? 0) > 0);

      let hasManifest = false;
      for (const manifest of (module.MANIFESTS ?? [])) {
        if (await pathExists(path.join(repoRoot, manifest))) {
          hasManifest = true;
          break;
        }
        // Also check subdirectories for multi-module projects (e.g. Cargo.toml, pom.xml)
        if ((await findManifestDirectories(repoRoot, manifest)).length > 0) {
          hasManifest = true;
          break;
        }
      }

      return { language, detected: hasFiles || hasManifest };
    }),
  );

  for (const { language, detected } of manifestChecks) {
    if (detected) languages.add(language);
  }

  // MongoDB detection: JS/TS files that import mongoose or mongodb
  // (already handled inside mongodbLinter.run — mark language present if JS detected)
  if (languages.has('javascript')) {
    languages.add('mongodb');
  }

  return {
    languages: [...languages],
    fileCounts,
  };
}

// ─── Fault isolation ──────────────────────────────────────────────────────────

function classifyLinterError(error) {
  if (error?.code === 'ENOENT') return 'binary_not_found';
  if (error?.name === 'SyntaxError' || error?.code === 'ERR_INVALID_ARG_TYPE') return 'parse_error';
  return 'runtime_error';
}

/**
 * Runs a single linter in an isolated try/catch so one failure never
 * aborts the rest of the pipeline.
 *
 * @param {string} linterId
 * @param {() => Promise<LintFileResult[]>} runner
 * @returns {Promise<LinterRunResult>}
 */
async function runIsolatedLinter(linterId, runner) {
  try {
    const results = await runner();
    return { linter: linterId, status: 'success', results, error: null, reason: null };
  } catch (error) {
    const reason = classifyLinterError(error);
    const errorMessage =
      reason === 'binary_not_found'
        ? `${linterId} binary not found. Install it on the server to enable ${linterId} linting.`
        : (error instanceof Error ? error.message : String(error));

    return { linter: linterId, status: 'failed', results: [], error: errorMessage, reason };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Runs all applicable linters against a cloned repository and returns a
 * unified, normalised set of lint findings.
 *
 * @param {string} repoRoot  - Absolute or relative path to the repo directory.
 * @param {Object} [options]
 * @param {string[] | null} [options.languages]  - Override detected language list.
 * @param {boolean} [options.runJavaScript]
 * @param {boolean} [options.runPython]
 * @param {boolean} [options.runRust]
 * @param {boolean} [options.runGo]
 * @param {boolean} [options.runJava]
 * @param {boolean} [options.runRuby]
 * @param {boolean} [options.runPhp]
 * @param {boolean} [options.runCpp]
 * @param {boolean} [options.runSwift]
 * @param {boolean} [options.runKotlin]
 * @param {boolean} [options.runShell]
 * @param {boolean} [options.runSql]
 * @param {boolean} [options.runMongodb]
 * @returns {Promise<RunLintersResponse>}
 */
export async function runLinters(repoRoot, options = {}) {
  const {
    languages = null,
    runJavaScript = true,
    runPython     = true,
    runRust       = true,
    runGo         = true,
    runJava       = true,
    runRuby       = true,
    runPhp        = true,
    runCpp        = true,
    runSwift      = true,
    runKotlin     = true,
    runShell      = true,
    runSql        = true,
    runMongodb    = true,
  } = options;

  const flags = {
    runJavaScript, runPython, runRust, runGo, runJava,
    runRuby, runPhp, runCpp, runSwift, runKotlin,
    runShell, runSql, runMongodb,
  };

  const absoluteRepoRoot = path.resolve(repoRoot);
  const repoStat = await fs.stat(absoluteRepoRoot).catch(() => null);
  if (!repoStat?.isDirectory()) {
    throw new Error(`Repository path is not a directory: ${repoRoot}`);
  }

  const detection = await detectLanguages(absoluteRepoRoot);
  const selectedLanguages = languages ?? detection.languages;

  const tasks = LINTER_REGISTRY
    .filter(({ language, flag }) => flags[flag] && selectedLanguages.includes(language))
    .map(({ linterId, module }) =>
      runIsolatedLinter(linterId, () => module.run(absoluteRepoRoot)),
    );

  const runs = await Promise.all(tasks);
  const successfulResults = runs.flatMap((run) => run.results);

  return {
    results: mergeResultsByFile(successfulResults),
    runs,
    detection,
  };
}

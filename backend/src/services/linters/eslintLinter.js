/**
 * eslintLinter.js
 *
 * ESLint 10 runner for JavaScript and TypeScript files.
 */

import { ESLint } from 'eslint';
import js from '@eslint/js';
import { normalizeSeverity, relPath } from './shared.js';

export const EXTENSIONS = ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'];
export const MANIFESTS = ['package.json'];

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
    // TypeScript rules unavailable — falls back to JS-only. Expected on machines
    // where typescript-eslint is not installed.
  }

  return new ESLint({
    cwd: repoRoot,
    // ESLint 10: use overrideConfig directly instead of searching target repo for
    // eslint.config.js (which external repos may not have).
    overrideConfigFile: true,
    overrideConfig: config,
    errorOnUnmatchedPattern: false,
  });
}

function normalizeEslintResults(eslintResults, repoRoot) {
  return eslintResults
    .filter((result) => result.messages.length > 0)
    .map((result) => ({
      // ESLint 10 returns absolute paths — convert to relative for consistency.
      filePath: relPath(repoRoot, result.filePath),
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

/**
 * @param {string} repoRoot
 * @returns {Promise<import('../linterService.js').LintFileResult[]>}
 */
export async function run(repoRoot) {
  const eslint = await buildEslintInstance(repoRoot);
  const eslintResults = await eslint.lintFiles(['**/*.{js,mjs,cjs,jsx,ts,tsx}']);
  return normalizeEslintResults(eslintResults, repoRoot);
}

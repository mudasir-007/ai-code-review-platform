/**
 * clippyLinter.js
 *
 * Cargo Clippy runner for Rust files.
 */

import { safeExec, LINTER_TIMEOUT_MS, normalizeSeverity, relPath } from './shared.js';
import { findManifestDirectories } from '../../utils/repoWalker.js';

export const EXTENSIONS = ['.rs'];
export const MANIFESTS = ['Cargo.toml'];

function normalizeClippyMessages(messages, repoRoot) {
  const results = new Map();

  for (const entry of messages) {
    if (entry.reason !== 'compiler-message') continue;

    const payload = entry.message;
    if (!payload || !Array.isArray(payload.spans) || payload.spans.length === 0) continue;

    const primarySpan = payload.spans.find((span) => span.is_primary) ?? payload.spans[0];
    const filePath = relPath(repoRoot, primarySpan.file_name);

    const existing = results.get(filePath) ?? { filePath, issues: [] };
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
  // cargo clippy exits non-zero when warnings are present under #[deny(clippy::...)]
  // or similar strict configs. safeExec absorbs the non-zero exit and returns stdout.
  const { stdout } = await safeExec(
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
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);

  return normalizeClippyMessages(messages, repoRoot);
}

/**
 * @param {string} repoRoot
 * @returns {Promise<import('../linterService.js').LintFileResult[]>}
 */
export async function run(repoRoot) {
  const cargoRoots = await findManifestDirectories(repoRoot, 'Cargo.toml');
  if (cargoRoots.length === 0) return [];

  const allResults = [];
  for (const cargoRoot of cargoRoots) {
    const projectResults = await runClippyInProject(cargoRoot, repoRoot);
    allResults.push(...projectResults);
  }

  // Merge duplicate file entries from multiple Cargo workspaces
  const merged = new Map();
  for (const r of allResults) {
    const existing = merged.get(r.filePath) ?? { filePath: r.filePath, issues: [] };
    existing.issues.push(...r.issues);
    merged.set(r.filePath, existing);
  }
  return [...merged.values()];
}

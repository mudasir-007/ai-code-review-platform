/**
 * cppLinter.js
 *
 * Cppcheck static analysis runner for C and C++ files.
 * Binary: cppcheck  (brew install cppcheck)
 *
 * Cppcheck writes XML to stderr by design, even on a clean run.
 */

import path from 'node:path';
import { safeExec, LINTER_TIMEOUT_MS, normalizeSeverity, relPath } from './shared.js';
import { walkRepo } from '../../utils/repoWalker.js';

export const EXTENSIONS = ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx'];
export const MANIFESTS = ['CMakeLists.txt', 'Makefile'];

// Matches individual <error .../> or <error ...></error> tags
const ERROR_TAG_RE = /<error\b[^>]*>/g;
const ATTR_RE = /(\w+)="([^"]*)"/g;

function unescapeXml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function parseCppcheckXml(xml, repoRoot) {
  const results = new Map();

  ERROR_TAG_RE.lastIndex = 0;
  let match;
  while ((match = ERROR_TAG_RE.exec(xml)) !== null) {
    const attrs = {};
    ATTR_RE.lastIndex = 0;
    let attrMatch;
    while ((attrMatch = ATTR_RE.exec(match[0])) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }

    // <location> is a child tag — extract file/line from it if present
    const locationMatch = xml
      .slice(match.index)
      .match(/<location\s+file="([^"]+)"\s+line="(\d+)"(?:\s+col="(\d+)")?/);

    const rawFile = locationMatch?.[1] ?? attrs.file ?? '';
    if (!rawFile) continue;

    const fp = relPath(repoRoot, rawFile);
    const existing = results.get(fp) ?? { filePath: fp, issues: [] };
    existing.issues.push({
      line: Number(locationMatch?.[2] ?? attrs.line) || 1,
      column: Number(locationMatch?.[3] ?? attrs.col) || 1,
      severity: normalizeSeverity(attrs.severity),
      message: unescapeXml(attrs.msg ?? ''),
      ruleId: `cppcheck/${attrs.id ?? 'unknown'}`,
      source: 'cppcheck',
    });
    results.set(fp, existing);
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

  // cppcheck writes results to stderr; exits 0 normally
  // Run on specific files rather than directory to avoid picking up build artefacts
  const { stderr } = await safeExec(
    'cppcheck',
    [
      '--xml',
      '--enable=warning,style,performance,portability',
      '--suppress=missingInclude',
      ...files.map((f) => path.join(repoRoot, f)),
    ],
    { cwd: repoRoot, timeout: LINTER_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 },
  );

  if (!stderr.trim()) return [];
  return parseCppcheckXml(stderr, repoRoot);
}

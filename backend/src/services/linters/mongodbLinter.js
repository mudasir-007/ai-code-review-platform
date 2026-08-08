/**
 * mongodbLinter.js
 *
 * Built-in static analyzer for MongoDB/Mongoose anti-patterns.
 * No external binary required — operates entirely on file content.
 *
 * Activated on .js/.ts files that import 'mongoose' or 'mongodb'.
 *
 * Checks:
 *  - $where usage (server-side JS injection risk)
 *  - find({}) with empty filter (full collection scan)
 *  - Unanchored $regex (may scan full collection)
 *  - Missing .lean() on Mongoose queries (memory overhead)
 *  - Collection .drop() calls (destructive operation)
 *  - new ObjectId() with no argument (ID generation vs wrapping)
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { walkRepo } from '../../utils/repoWalker.js';

export const EXTENSIONS = ['.js', '.ts', '.mjs', '.cjs'];
export const MANIFESTS = [];

// ─── Import detection ──────────────────────────────────────────────────────────

const MONGO_IMPORT_PATTERNS = [
  /require\s*\(\s*['"]mongoose['"]\s*\)/,
  /require\s*\(\s*['"]mongodb['"]\s*\)/,
  /from\s+['"]mongoose['"]/,
  /from\s+['"]mongodb['"]/,
  /import\s+mongoose/,
];

function isMongoFile(content) {
  return MONGO_IMPORT_PATTERNS.some((p) => p.test(content));
}

// ─── Anti-pattern rules ────────────────────────────────────────────────────────

const RULES = [
  {
    // $where executes arbitrary JS in MongoDB server process
    pattern: /\$where\s*:/,
    ruleId: 'mongodb/no-where-operator',
    severity: 'error',
    message:
      'Avoid $where — it executes arbitrary JavaScript server-side and is a code injection risk. Use $expr instead.',
  },
  {
    // .find({}) returns ALL documents — high risk in production collections
    pattern: /\.find\(\s*\{\s*\}\s*[),]/,
    ruleId: 'mongodb/no-empty-filter',
    severity: 'warning',
    message:
      '.find({}) fetches all documents. Add a query predicate, or use .limit() if you intentionally want all records.',
  },
  {
    // Unanchored $regex may degrade to a full collection scan
    pattern: /\$regex\s*:/,
    ruleId: 'mongodb/anchor-regex',
    severity: 'warning',
    message:
      'Unanchored $regex can cause a full collection scan. Prefix with ^ to use an index, or prefer $text search.',
  },
  // NOTE: prefer-lean is intentionally omitted from RULES because it requires
  // multi-line lookahead that a single-line regex cannot perform correctly.
  // It is implemented separately in the run() function below.
  {
    // .drop() is irreversible — should not be reachable from application code
    pattern: /\.\s*drop\s*\(\s*\)/,
    ruleId: 'mongodb/no-collection-drop',
    severity: 'error',
    message:
      'Collection .drop() detected. Ensure this is intentional and never reachable from live application code.',
  },
  {
    // new ObjectId() with no argument creates a NEW id; callers often mean wrapping
    pattern: /new\s+ObjectId\s*\(\s*\)/,
    ruleId: 'mongodb/objectid-no-empty',
    severity: 'info',
    message:
      'new ObjectId() generates a fresh ID. If you want to wrap an existing string id, use new ObjectId(id).',
  },
  {
    // updateMany/deleteMany without filter — affects ALL documents
    pattern: /\.(updateMany|deleteMany)\s*\(\s*\{\s*\}/,
    ruleId: 'mongodb/no-empty-bulk-filter',
    severity: 'error',
    message:
      'updateMany/deleteMany with an empty filter {} will modify ALL documents in the collection.',
  },
];

// ─── Runner ────────────────────────────────────────────────────────────────────

/**
 * @param {string} repoRoot
 * @returns {Promise<import('../linterService.js').LintFileResult[]>}
 */
export async function run(repoRoot) {
  const files = await walkRepo(repoRoot, { extensions: EXTENSIONS });
  if (files.length === 0) return [];

  const results = [];

  for (const relFilePath of files) {
    let content;
    try {
      content = await fs.readFile(path.join(repoRoot, relFilePath), 'utf8');
    } catch {
      continue;
    }

    if (!isMongoFile(content)) continue;

    const lines = content.split('\n');
    const issues = [];

    for (const { pattern, ruleId, severity, message } of RULES) {
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        const matchIndex = lineText.search(pattern);
        if (matchIndex === -1) continue;

        // Skip lines that are commented out
        const trimmed = lineText.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
          continue;
        }

        issues.push({
          line: i + 1,
          column: matchIndex + 1,
          severity,
          message,
          ruleId,
          source: 'mongodb-analyzer',
        });
      }
    }

    if (issues.length > 0) {
      results.push({ filePath: relFilePath, issues });
    }

    // ── prefer-lean: multi-line lookahead ────────────────────────────────────
    // Matches only Capitalized.find() / Capitalized.findOne() (Mongoose model
    // convention) to avoid false-positives on Array.prototype.find().
    // Then checks whether .lean() appears within the next 5 lines.
    const LEAN_MODEL_RE = /\b([A-Z][A-Za-z0-9]*)\.(find(?:One)?)\s*\(/g;
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const trimmed = lineText.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) continue;

      LEAN_MODEL_RE.lastIndex = 0;
      if (!LEAN_MODEL_RE.test(lineText)) continue;

      // Look ahead up to 5 lines for a .lean() call
      const lookaheadEnd = Math.min(i + 5, lines.length);
      const block = lines.slice(i, lookaheadEnd).join('\n');
      if (/\.lean\s*\(/.test(block)) continue;

      issues.push({
        line: i + 1,
        column: lineText.indexOf('.find') + 1,
        severity: 'info',
        message: 'Consider .lean() on Mongoose read-only queries to return plain JS objects and reduce memory overhead.',
        ruleId: 'mongodb/prefer-lean',
        source: 'mongodb-analyzer',
      });
    }

    if (issues.length > 0 && !results.some((r) => r.filePath === relFilePath)) {
      results.push({ filePath: relFilePath, issues });
    }
  }

  return results;
}

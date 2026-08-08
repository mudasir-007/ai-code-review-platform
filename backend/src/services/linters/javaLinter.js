/**
 * javaLinter.js
 *
 * Checkstyle runner for Java files.
 * Binary: checkstyle  (https://checkstyle.org/)
 * Install: brew install checkstyle  OR  download JAR and alias as `checkstyle`
 *
 * Uses Google's bundled rule set (/google_checks.xml is a classpath resource
 * inside the checkstyle JAR — no external file needed).
 */

import { safeExec, LINTER_TIMEOUT_MS, normalizeSeverity, relPath } from './shared.js';

export const EXTENSIONS = ['.java'];
export const MANIFESTS = ['pom.xml', 'build.gradle', 'build.gradle.kts'];

// Matches:  <error line="N" column="N" severity="S" message="M" source="R"/>
// Attribute order in Checkstyle XML is stable but we match each individually.
const ATTR_RE = /(\w+)="([^"]*)"/g;
const ERROR_TAG_RE = /<error\s[^/]*/g;
const FILE_TAG_RE = /<file\s+name="([^"]+)"/g;

function unescapeXml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseCheckstyleXml(xml, repoRoot) {
  const results = new Map();

  // Split by <file> tags to associate errors with their file
  const fileChunks = [];
  let fileMatch;
  FILE_TAG_RE.lastIndex = 0;
  while ((fileMatch = FILE_TAG_RE.exec(xml)) !== null) {
    fileChunks.push({ name: fileMatch[1], start: fileMatch.index });
  }

  for (let i = 0; i < fileChunks.length; i++) {
    const { name, start } = fileChunks[i];
    const end = fileChunks[i + 1]?.start ?? xml.length;
    const segment = xml.slice(start, end);
    const fp = relPath(repoRoot, name);

    ERROR_TAG_RE.lastIndex = 0;
    let errMatch;
    while ((errMatch = ERROR_TAG_RE.exec(segment)) !== null) {
      const attrs = {};
      ATTR_RE.lastIndex = 0;
      let attrMatch;
      while ((attrMatch = ATTR_RE.exec(errMatch[0])) !== null) {
        attrs[attrMatch[1]] = attrMatch[2];
      }

      const existing = results.get(fp) ?? { filePath: fp, issues: [] };
      existing.issues.push({
        line: Number(attrs.line) || 1,
        column: Number(attrs.column) || 1,
        severity: normalizeSeverity(attrs.severity),
        message: unescapeXml(attrs.message ?? ''),
        // source is a fully-qualified class name like com.puppycrawl...MaxLineLength
        ruleId: `checkstyle/${attrs.source?.split('.').pop() ?? 'unknown'}`,
        source: 'checkstyle',
      });
      results.set(fp, existing);
    }
  }

  return [...results.values()];
}

/**
 * @param {string} repoRoot
 * @returns {Promise<import('../linterService.js').LintFileResult[]>}
 */
export async function run(repoRoot) {
  // -r = recursively check directory; /google_checks.xml is bundled in the JAR
  // Checkstyle exits 1 when violations found; output is in stdout
  const { stdout } = await safeExec(
    'checkstyle',
    ['-f', 'xml', '-c', '/google_checks.xml', '-r', '.'],
    { cwd: repoRoot, timeout: LINTER_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 },
  );

  if (!stdout.trim()) return [];
  return parseCheckstyleXml(stdout, repoRoot);
}

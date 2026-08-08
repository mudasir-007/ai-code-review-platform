import fs from 'node:fs/promises';
import path from 'node:path';
import { walkRepo } from '../utils/repoWalker.js';

// ---------------------------------------------------------------------------
// Secret patterns
// Each entry: { id, label, pattern (RegExp with global flag) }
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
  {
    id: 'aws_access_key_id',
    label: 'AWS Access Key ID',
    // AKIA / ASIA / AROA / ABIA / ACCA followed by 16 uppercase alphanumeric chars
    pattern: /\b(AKIA|ASIA|AROA|ABIA|ACCA)[0-9A-Z]{16}\b/g,
  },
  {
    id: 'aws_secret_access_key',
    label: 'AWS Secret Access Key',
    // 40-char base64-ish string on the right of an assignment containing "aws_secret"
    pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*['"]?([A-Za-z0-9/+]{40})['"]?/g,
  },
  {
    id: 'github_pat',
    label: 'GitHub Personal Access Token',
    // Classic (ghp_) or fine-grained (github_pat_) PATs
    pattern: /\b(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82})\b/g,
  },
  {
    id: 'github_oauth_token',
    label: 'GitHub OAuth / App Token',
    pattern: /\b(gho_|ghs_|ghr_)[A-Za-z0-9]{36}\b/g,
  },
  {
    id: 'private_key_pem',
    label: 'Private Key (PEM block)',
    // RSA, EC, DSA, OpenSSH private key headers
    pattern: /-----BEGIN\s+(?:RSA|EC|DSA|OPENSSH|PRIVATE)\s+PRIVATE\s+KEY-----/g,
  },
  {
    id: 'generic_api_key_assignment',
    label: 'Generic API Key / Secret Assignment',
    // api_key = "...", secret_key = "...", access_token = "..." with value ≥ 16 chars
    pattern:
      /(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*['"`]([A-Za-z0-9\-_.+/]{16,})['"`]/gi,
  },
  {
    id: 'slack_token',
    label: 'Slack Token',
    pattern: /\b(xox[baprs]-[0-9A-Za-z\-]{10,})\b/g,
  },
  {
    id: 'stripe_key',
    label: 'Stripe API Key',
    pattern: /\b(sk_live_[0-9A-Za-z]{24}|pk_live_[0-9A-Za-z]{24})\b/g,
  },
  {
    id: 'sendgrid_key',
    label: 'SendGrid API Key',
    pattern: /\bSG\.[A-Za-z0-9\-_]{22}\.[A-Za-z0-9\-_]{43}\b/g,
  },
  {
    id: 'jwt_secret',
    label: 'JWT Secret (hardcoded)',
    // JWT_SECRET = "..." with value ≥ 16 chars that looks like a random string
    pattern: /(?:JWT_SECRET|jwt_secret)\s*[:=]\s*['"`]([A-Za-z0-9!@#$%^&*\-_.]{16,})['"`]/g,
  },
  {
    id: 'dotenv_file_in_repo',
    label: '.env file committed to repository',
    // Detects key=value pairs that look like .env file contents
    pattern: /^[A-Z_]{2,}=[^\s#]{4,}$/gm,
  },
];

// ---------------------------------------------------------------------------
// File extensions to scan (text / source files only)
// ---------------------------------------------------------------------------

const SCANNABLE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx',
  '.ts', '.tsx',
  '.py', '.rb', '.php', '.go', '.rs', '.java', '.kt', '.swift', '.cs',
  '.sh', '.bash', '.zsh', '.env', '.env.example', '.env.local', '.env.production',
  '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.json', '.xml',
  '.md', '.txt',
  '.dockerfile', '.Dockerfile',
]);

/** Max bytes read per file — avoids reading huge binaries/minified files. */
const MAX_FILE_READ_BYTES = 512 * 1024; // 512 KB

/** Max files to scan — matches repoWalker's DEFAULT_MAX_FILES. */
const MAX_FILES_TO_SCAN = 5000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isScannableFile(filePath) {
  const base = path.basename(filePath).toLowerCase();

  // Explicitly named .env files (no extension)
  if (base === '.env' || base.startsWith('.env.')) return true;

  const ext = path.extname(filePath).toLowerCase();
  return SCANNABLE_EXTENSIONS.has(ext);
}

/**
 * Scans a single file's content against all secret patterns.
 * Returns an array of findings for that file.
 */
function scanContent(content, relativeFilePath) {
  const findings = [];

  for (const { id, label, pattern } of SECRET_PATTERNS) {
    // Reset lastIndex since patterns use the global flag
    pattern.lastIndex = 0;

    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(line)) !== null) {
        // Redact the actual match value so we don't echo secrets in logs
        const redacted = match[0].slice(0, 6) + '***REDACTED***';

        findings.push({
          filePath: relativeFilePath,
          line: lineIndex + 1,
          patternId: id,
          label,
          matchPreview: redacted,
        });

        // Avoid infinite loops on zero-width matches
        if (match[0].length === 0) {
          pattern.lastIndex++;
        }
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SecretFinding
 * @property {string} filePath    - Relative path from sourceRoot
 * @property {number} line        - 1-indexed line number
 * @property {string} patternId   - Machine-readable pattern identifier
 * @property {string} label       - Human-readable pattern label
 * @property {string} matchPreview - Redacted preview of the match
 */

/**
 * @typedef {Object} SecretScanResult
 * @property {SecretFinding[]} findings   - All findings across all files
 * @property {string[]} warnings          - Non-fatal issues (e.g. file read errors)
 * @property {{ scannedFiles: number, skippedFiles: number, findingsCount: number }} stats
 */

/**
 * Scans all text/source files in a repo for common secret patterns.
 *
 * Designed to be non-blocking: findings are returned as data, not thrown as
 * errors. The caller decides whether to block the pipeline or just warn.
 *
 * @param {string} sourceRoot - Absolute path to the extracted repo root
 * @returns {Promise<SecretScanResult>}
 */
export async function scanForSecrets(sourceRoot) {
  const findings = [];
  const warnings = [];
  let scannedFiles = 0;
  let skippedFiles = 0;

  // Collect all files from the repo, respecting standard ignore rules
  const allFiles = await walkRepo(sourceRoot, {
    maxFiles: MAX_FILES_TO_SCAN,
    // Don't filter by extension here — we do our own check below so we can
    // also catch extensionless .env files
    extensions: null,
  });

  for (const relativeFilePath of allFiles) {
    if (!isScannableFile(relativeFilePath)) {
      skippedFiles++;
      continue;
    }

    const absolutePath = path.join(sourceRoot, relativeFilePath);

    let content;
    try {
      const stat = await fs.stat(absolutePath);

      // Skip files larger than the read cap
      if (stat.size > MAX_FILE_READ_BYTES) {
        warnings.push(
          `Skipped secret scan for oversized file: ${relativeFilePath} (${(stat.size / 1024).toFixed(0)} KB)`,
        );
        skippedFiles++;
        continue;
      }

      content = await fs.readFile(absolutePath, 'utf8');
    } catch (error) {
      warnings.push(`Could not read file for secret scan: ${relativeFilePath} — ${error.message}`);
      skippedFiles++;
      continue;
    }

    const fileFindings = scanContent(content, relativeFilePath);
    findings.push(...fileFindings);
    scannedFiles++;
  }

  return {
    findings,
    warnings,
    stats: {
      scannedFiles,
      skippedFiles,
      findingsCount: findings.length,
    },
  };
}

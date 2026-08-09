export const MOCK_REPORT = {
  repoUrl: 'https://github.com/mudasir-007/ai-code-review-platform',
  defaultBranch: 'main',
  languages: ['javascript', 'python'],
  providerUsed: 'groq',
  summary:
    'The auth flow is solid and the pipeline is well fault-isolated, but a few files handle user input without validation and one endpoint logs a raw error object.',
  score: 78,
  issues: [
    {
      file: 'src/controllers/authController.js',
      line: 23,
      severity: 'error',
      category: 'security',
      message: 'Password hash comparison result is not checked before issuing a session.',
      suggestion: 'Reject the request immediately when bcrypt.compare returns false.',
    },
    {
      file: 'src/services/repoService.js',
      line: 88,
      severity: 'warning',
      category: 'performance',
      message: 'Zipball buffer is held fully in memory before writing to disk.',
      suggestion: 'Stream the response directly to the extraction step for large repos.',
    },
    {
      file: 'src/routes/githubAuth.js',
      line: 41,
      severity: 'warning',
      category: 'logic',
      message: 'OAuth callback logs the full user profile object to stdout.',
      suggestion: 'Log only the username or user id, not the full payload.',
    },
    {
      file: 'src/utils/repoWalker.js',
      line: 12,
      severity: 'info',
      category: 'style',
      message: 'Magic number 20 used for max depth without a named constant nearby.',
      suggestion: 'Reference DEFAULT_MAX_DEPTH directly instead of repeating the value.',
    },
  ],
  secretsFound: 0,
  validationWarnings: [
    { code: 'REPO_LARGE', message: 'Repository size is approximately 340.2 MB (GitHub metadata).' },
  ],
  lintIssuesFound: 12,
  linterRuns: [
    { linter: 'eslint', status: 'success', issueCount: 9, reason: null },
    { linter: 'flake8', status: 'success', issueCount: 3, reason: null },
    { linter: 'clippy', status: 'skipped', issueCount: 0, reason: null },
    { linter: 'checkstyle', status: 'failed', issueCount: 0, reason: 'binary_not_found' },
  ],
  generatedAt: new Date().toISOString(),
};

export const MOCK_SECRETS_BLOCKED_ERROR = {
  error:
    'Secret scan detected 2 potential secret(s) in the repository. Review aborted to prevent leaking credentials to the AI provider.',
  code: 'SECRETS_FOUND',
  details: {
    findingsCount: 2,
    findings: [
      { filePath: 'config/production.js', line: 14, label: 'AWS Access Key ID' },
      { filePath: '.env', line: 3, label: '.env file committed to repository' },
    ],
  },
};

/**
 * reviewController.js
 *
 * Handles POST /api/review — validates input, runs the review pipeline,
 * returns the ReviewReport or a structured error.
 */

import { reviewRepository } from '../services/reviewService.js';
import { ReviewGenerationError } from '../services/aiProviderService.js';
import { RepoFetchError } from '../services/repoService.js';
import { ValidationError } from '../services/validationService.js';

// Cheap pre-flight guard — catches obviously malformed URLs before making any
// network calls. Full validation (gist rejection, rate-limit, empty-repo, etc.)
// is handled by validateGitHubRepository() inside reviewService.
const GITHUB_URL_RE = /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/;

/**
 * POST /api/review
 * Body: { repoUrl: string, branch?: string, githubToken?: string }
 */
export async function createReview(req, res) {
  const { repoUrl, branch, githubToken } = req.body ?? {};

  // ── Input validation ───────────────────────────────────────────────────────
  if (!repoUrl || typeof repoUrl !== 'string') {
    return res.status(400).json({
      error: 'repoUrl is required',
      code: 'MISSING_REPO_URL',
    });
  }

  if (!GITHUB_URL_RE.test(repoUrl.trim())) {
    return res.status(400).json({
      error: 'repoUrl must be a valid GitHub repository URL (e.g. https://github.com/owner/repo)',
      code: 'INVALID_REPO_URL',
    });
  }

  // ── Run pipeline ───────────────────────────────────────────────────────────
  try {
    const report = await reviewRepository({
      repoUrl: repoUrl.trim(),
      branch: typeof branch === 'string' && branch.trim() ? branch.trim() : undefined,
      githubToken: githubToken ?? process.env.GITHUB_TOKEN,
    });

    return res.status(200).json({ success: true, report });
  } catch (err) {
    // Validation errors: bad URL, gist, rate-limit, empty/archived repo, secrets found
    if (err instanceof ValidationError) {
      return res.status(err.statusCode ?? 422).json({
        error: err.message,
        code: err.code ?? 'VALIDATION_ERROR',
        details: err.details,
      });
    }

    // Repo fetch / size / auth errors
    if (err instanceof RepoFetchError) {
      return res.status(err.statusCode ?? 422).json({
        error: err.message,
        code: err.code ?? 'REPO_FETCH_ERROR',
        details: err.details,
      });
    }

    // Both AI providers failed
    if (err instanceof ReviewGenerationError) {
      return res.status(503).json({
        error: err.message,
        code: 'AI_UNAVAILABLE',
        details: {
          groqError:   err.groqError,
          geminiError: err.geminiError,
        },
      });
    }

    // Unexpected error
    console.error('[reviewController] Unexpected error:', err);
    return res.status(500).json({
      error: 'An unexpected error occurred while reviewing the repository.',
      code: 'INTERNAL_ERROR',
    });
  }
}

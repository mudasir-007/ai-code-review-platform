import prisma from '../config/db.js';
import { reviewRepository, ValidationError, RepoFetchError, ReviewGenerationError, DiffError } from '../services/reviewService.js';

//* Creates a repository record linked to the logged-in user
export const createRepository = async (req, res) => {
  try {
    const { githubId, name, fullName, owner, url, private: isPrivate } = req.body;

    const repository = await prisma.repository.create({
      data: {
        githubId,
        name,
        fullName,
        owner,
        url,
        private: isPrivate || false,
        userId: req.userId, // comes from the authenticate middleware
      },
    });

    res.status(201).json({ repository });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

//* Returns all repositories belonging to the logged-in user
export const getMyRepositories = async (req, res) => {
  try {
    const repositories = await prisma.repository.findMany({
      where: { userId: req.userId },
    });

    res.json({ repositories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

//* POST /api/repositories/:id/review
//*
//* Triggers a review for a repository owned by the logged-in user.
//* - First review (or forceFull: true) -> full whole-repo review.
//* - Every review after that -> incremental, diffed against
//*   repository.lastReviewedSha, merged with the last stored Review's issues.
//* - autoPr: true -> if findings cross scoringService's threshold, an AI-fix
//*   PR is opened automatically (githubToken must have `repo` write scope).
//*
//* Body: { githubToken?: string, autoPr?: boolean, forceFull?: boolean }
export const triggerRepositoryReview = async (req, res) => {
  const repository = await prisma.repository.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });

  if (!repository) {
    return res.status(404).json({ error: 'Repository not found', code: 'REPOSITORY_NOT_FOUND' });
  }

  const { githubToken, autoPr, forceFull } = req.body ?? {};
  const token = githubToken ?? process.env.GITHUB_TOKEN;

  const lastReview = await prisma.review.findFirst({
    where: { repositoryId: repository.id },
    orderBy: { createdAt: 'desc' },
  });

  const runReview = (baseSha, previousIssues) =>
    reviewRepository({
      repoUrl: repository.url,
      branch: repository.lastReviewedBranch ?? undefined,
      githubToken: token,
      baseSha,
      previousIssues,
      autoPr: !!autoPr,
    });

  try {
    let report;
    try {
      report = await runReview(
        forceFull ? null : repository.lastReviewedSha,
        lastReview?.issues ?? [],
      );
    } catch (err) {
      // Base commit no longer comparable (force-push / history rewrite) —
      // fall back to a full review instead of failing the request outright.
      if (err instanceof DiffError && err.code === 'BASE_NOT_COMPARABLE') {
        report = await runReview(null, []);
      } else {
        throw err;
      }
    }

    const savedReview = await prisma.review.create({
      data: {
        repositoryId: repository.id,
        mode: report.mode,
        baseSha: report.baseSha,
        headSha: report.headSha,
        score: report.score ?? lastReview?.score ?? 0,
        summary: report.summary,
        issues: report.issues,
        changedFiles: report.changedFiles,
        prCreated: !!report.pr?.opened,
        prUrl: report.pr?.prUrl ?? null,
        prNumber: report.pr?.prNumber ?? null,
      },
    });

    await prisma.repository.update({
      where: { id: repository.id },
      data: { lastReviewedSha: report.headSha, lastReviewedBranch: report.defaultBranch },
    });

    return res.status(200).json({ success: true, report, reviewId: savedReview.id });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(err.statusCode ?? 422).json({ error: err.message, code: err.code, details: err.details });
    }
    if (err instanceof RepoFetchError) {
      return res.status(err.statusCode ?? 422).json({ error: err.message, code: err.code, details: err.details });
    }
    if (err instanceof DiffError) {
      return res.status(err.statusCode ?? 422).json({ error: err.message, code: err.code, details: err.details });
    }
    if (err instanceof ReviewGenerationError) {
      return res.status(503).json({
        error: err.message,
        code: 'AI_UNAVAILABLE',
        details: { groqError: err.groqError, geminiError: err.geminiError },
      });
    }
    console.error('[triggerRepositoryReview] Unexpected error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred while reviewing the repository.', code: 'INTERNAL_ERROR' });
  }
};

//* GET /api/repositories/:id/reviews — review history for a repository
export const getRepositoryReviews = async (req, res) => {
  const repository = await prisma.repository.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });

  if (!repository) {
    return res.status(404).json({ error: 'Repository not found', code: 'REPOSITORY_NOT_FOUND' });
  }

  const reviews = await prisma.review.findMany({
    where: { repositoryId: repository.id },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ reviews });
};
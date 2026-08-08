/**
 * reviewRoutes.js
 *
 * POST /api/review — trigger a full AI code review on a GitHub repository.
 */

import { Router } from 'express';
import { createReview } from '../controllers/reviewController.js';

const router = Router();

/**
 * POST /api/review
 *
 * Body:
 *   repoUrl      {string}  required  GitHub repo URL
 *   branch       {string}  optional  Branch to review (default: main)
 *   githubToken  {string}  optional  GitHub PAT for private repos
 *
 * Returns: { success: true, report: ReviewReport }
 */
router.post('/', createReview);

export default router;

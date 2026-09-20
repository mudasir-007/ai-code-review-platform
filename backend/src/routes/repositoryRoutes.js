import express from 'express';
import {
  createRepository,
  getMyRepositories,
  triggerRepositoryReview,
  getRepositoryReviews,
} from '../controllers/repositoryController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', authenticate, createRepository);
router.get('/', authenticate, getMyRepositories);

//* Triggers a full review (first time) or an incremental diff-based review
//* (every time after) for a repository the user owns. See
//* repositoryController.triggerRepositoryReview for the request body.
router.post('/:id/review', authenticate, triggerRepositoryReview);
router.get('/:id/reviews', authenticate, getRepositoryReviews);

export default router;

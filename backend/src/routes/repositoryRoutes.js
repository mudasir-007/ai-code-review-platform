import express from 'express';
import { createRepository, getMyRepositories } from '../controllers/repositoryController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', authenticate, createRepository);
router.get('/', authenticate, getMyRepositories);

export default router;

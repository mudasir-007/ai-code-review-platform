import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import authRoutes from './routes/authRoutes.js';
import repositoryRoutes from './routes/repositoryRoutes.js';
import githubAuthRoutes from './routes/githubAuth.js';
import reviewRoutes from './routes/reviewRoutes.js';

const app = express();

//* Allows the frontend (different origin) to call this API
app.use(cors());

//* Parses incoming JSON request bodies into req.body
app.use(express.json());

//* All auth routes are mounted under /api/auth
app.use('/api/auth', authRoutes);

app.use('/api/auth', githubAuthRoutes);

app.use('/api/repositories', repositoryRoutes);

//* AI code review pipeline
app.use('/api/review', reviewRoutes);

app.get('/', (req, res) => {
  res.send('AI Code Review API is running');
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
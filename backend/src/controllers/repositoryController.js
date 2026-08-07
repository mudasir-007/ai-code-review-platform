import prisma from '../config/db.js';

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
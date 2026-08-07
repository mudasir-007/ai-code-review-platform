import express from 'express';
import axios from 'axios';

const router = express.Router();

// Step A: Redirect user to GitHub's login/consent screen
router.get('/github', (req, res) => {
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_CALLBACK_URL}&scope=repo,read:user`;
  res.redirect(redirectUrl);
});

// Step B: GitHub redirects back here with a ?code=
router.get('/github/callback', async (req, res) => {
  const { code } = req.query;

  try {
    // Exchange the code for an access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: 'application/json' } }
    );

    const { access_token } = tokenResponse.data;

    // Use the access token to fetch the user's GitHub profile
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${access_token}` },
    });

    console.log('GitHub user:', userResponse.data);

    // TODO: save access_token + user info to your DB (Prisma) here

    res.json({ message: 'GitHub auth successful', user: userResponse.data });
  } catch (error) {
    console.error('GitHub OAuth error:', error.message);
    res.status(500).json({ message: 'GitHub authentication failed' });
  }
});

export default router;
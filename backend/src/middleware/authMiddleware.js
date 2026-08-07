import jwt from 'jsonwebtoken';

//* Middleware: authenticate
//* Purpose: Verifies that an incoming request carries a valid JWT before
//* allowing it to reach any protected route handler.
//* Usage: router.get('/some-protected-route', authenticate, controllerFn);
export const authenticate = (req, res, next) => {
  // Clients must send their token in the standard "Authorization" header,
  // formatted as:  Authorization: Bearer <token>
  const authHeader = req.headers.authorization;

  //* Guard clause: reject immediately if no token was sent, or if it's
  //* not in the expected "Bearer <token>" format.
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // authHeader looks like "Bearer eyJhbGc...". .split(' ') breaks it
  // into an array: ["Bearer", "eyJhbGc..."]. [1] grabs the second item —
  // just the actual token, without the word "Bearer".
  const token = authHeader.split(' ')[1];

  try {
    //* Core security check: verifies the token's signature (proving it
    //* was issued by this server and not tampered with) AND that it
    //* hasn't expired. Throws if either check fails.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    //* Attach the authenticated user's ID onto the request object so
    //* downstream route handlers can access it via req.userId, without
    //* needing a session store or repeated database lookups here.
    req.userId = decoded.userId;

    //* Verification passed — hand control to the next middleware/handler
    //* in the chain (e.g., the actual controller function).
    next();
  } 
  catch (error) {
  console.error('Auth error:', error.message);
  res.status(401).json({ message: 'Not authorized' });
  }
};
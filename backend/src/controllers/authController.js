import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';

//* Controller: register
//* Purpose: Creates a new user account with a securely hashed password
//* and returns a signed JWT so the user is immediately logged in.
//* Route: POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    //* Enforce email uniqueness at the application level so we can
    //* return a clear, user-friendly error instead of a raw database
    //* constraint exception.
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    //* Never store plain-text passwords. bcrypt.hash runs the password
    //* through 2^10 (1024) rounds of hashing plus a random salt.
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });

    //* Issue a JWT immediately after registration so the client is
    //* logged in without a separate login step. Payload holds only
    //* the user ID — never sensitive data.
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    //* Explicitly whitelist returned fields — password must never
    //* appear in any API response, even hashed.
    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

//* Controller: login
//* Purpose: Verifies a user's credentials and issues a fresh JWT.
//* Route: POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Look up the user by email.
    const user = await prisma.user.findUnique({ where: { email } });

    //* Security note: this check returns the SAME generic error
    //* ("Invalid credentials") whether the email doesn't exist at all,
    //* or exists but the password is wrong (see next check below).
    //* We deliberately do NOT say "Email not found" here — revealing
    //* that would let an attacker enumerate which emails are registered
    //* on the platform simply by trying different addresses.
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    //* bcrypt.compare re-hashes the submitted password with the same
    //* salt stored in user.password and checks for a match — this is
    //* the only valid way to "check" a hash, since hashing is one-way
    //* and can never be reversed back to plain text.
    const isPasswordValid = await bcrypt.compare(password, user.password);

    //* Same generic "Invalid credentials" message here too, for the
    //* identical reason above — keeps the wrong-password case and the
    //* no-such-user case indistinguishable to an attacker.
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

//* Controller: getCurrentUser
//* Purpose: Returns the profile of whichever user the request's JWT
//* belongs to. Relies entirely on req.userId, which is only ever set
//* by the `authenticate` middleware after successful token verification.
//* Route: GET /api/auth/me (protected — requires `authenticate` middleware)
export const getCurrentUser = async (req, res) => {
  try {
    //* select: explicitly whitelists returned fields at the query
    //* level — password is excluded here, never even pulled from the
    //* database, which is a stronger guarantee than filtering it out
    //* of the response object afterward.
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    //* Edge case: token is valid, but the user was deleted afterward.
    //* Handle gracefully instead of crashing.
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};
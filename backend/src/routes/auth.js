import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import { config } from '../config.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { verifyFirebaseIdToken } from '../utils/firebaseAuth.js';
import {
  createUser,
  findUserByEmail,
  verifyPassword,
  findOrCreateFirebaseUser,
  getUserById,
  updateUser,
} from '../services/userService.js';

const router = Router();

function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, name: user.name },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function nameFromEmail(email) {
  const local = String(email || '').split('@')[0] || 'Member';
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
    .slice(0, 60);
}

const emailField = () => body('email').isString().trim().isEmail().withMessage('Enter a valid email address');

router.post('/register', [
  emailField(),
  body('password').isString().isLength({ min: 6 }).isByteLength({ max: 72 })
    .withMessage('Use at least 6 characters and at most 72 bytes for your password'),
], validate, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await createUser({ email, password, name: nameFromEmail(email) });
  res.status(201).json({ success: true, data: { user, token: signToken(user) } });
}));

router.post('/login', [
  emailField(),
  body('password').isString().notEmpty().withMessage('Enter your password'),
], validate, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const account = await findUserByEmail(email);
  if (!await verifyPassword(account, password)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password. If you have not registered on this store, choose Create Account.',
    });
  }
  const user = await getUserById(account.id);
  res.json({ success: true, data: { user, token: signToken(user) } });
}));

router.get(
  '/providers',
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      data: {
        firebase: Boolean(config.firebaseProjectId),
        google: Boolean(config.firebaseProjectId),
        projectId: config.firebaseProjectId || null,
      },
    });
  })
);

router.post(
  '/firebase',
  [body('idToken').notEmpty().withMessage('Firebase ID token required')],
  validate,
  asyncHandler(async (req, res) => {
    const claims = await verifyFirebaseIdToken(req.body.idToken);
    const user = await findOrCreateFirebaseUser({
      firebaseUid: claims.uid,
      email: claims.email,
      name: claims.name || nameFromEmail(claims.email),
      signInProvider: claims.signInProvider,
    });
    const token = signToken(user);
    res.json({
      success: true,
      message: 'Signed in with Firebase',
      data: { user, token },
    });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.user.id);
    res.json({ success: true, data: { user } });
  })
);

router.put(
  '/me',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const user = await updateUser(req.user.id, {
      name: req.body.name,
      password: req.body.password,
    });
    res.json({ success: true, data: { user } });
  })
);

export default router;

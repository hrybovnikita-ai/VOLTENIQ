import { resetPasswordWithEmailLink } from '../services/passwordRecovery.js';
import { Router } from 'express';
import { startSession, endSession, sessionUser } from '../services/sessionService.js';
import { body } from 'express-validator';
import { config } from '../config.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { verifyFirebaseIdToken } from '../utils/firebaseAuth.js';
import { verifyClerkSessionToken } from '../utils/clerkAuth.js';
import {
  createUser,
  findUserByEmail,
  verifyPassword,
  findOrCreateFirebaseUser,
  findOrCreateClerkUser,
  getUserById,
  updateUser,
} from '../services/userService.js';

const router = Router();

function nameFromEmail(email) {
  const local = String(email || '').split('@')[0] || 'Member';
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
    .slice(0, 60);
}

const emailField = () => body('email').isString().trim().isEmail().withMessage('Enter a valid email address');

router.post('/reset-password', [
  emailField(),
  body('code').isString().isLength({ min: 1, max: 2048 }),
  body('password').isString().isLength({ min: 6 }).isByteLength({ max: 72 })
    .withMessage('Use at least 6 characters and at most 72 bytes for your password'),
], validate, asyncHandler(async (req, res) => {
  const { email, code, password } = req.body;
  await resetPasswordWithEmailLink(email, code, password);
  res.json({ success: true });
}));

router.post('/register', [
  emailField(),
  body('password').isString().isLength({ min: 6 }).isByteLength({ max: 72 })
    .withMessage('Use at least 6 characters and at most 72 bytes for your password'),
], validate, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await createUser({ email, password, name: nameFromEmail(email) });
  await startSession(req, res, user.id);
  res.status(201).json({ success: true, data: { user } });
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
  await startSession(req, res, user.id);
  res.json({ success: true, data: { user } });
}));

router.get(
  '/providers',
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      data: {
        clerk: config.clerkEnabled,
        firebase: Boolean(config.firebaseProjectId) && !config.clerkEnabled,
        google: config.clerkEnabled || Boolean(config.firebaseProjectId),
        projectId: config.firebaseProjectId || null,
      },
    });
  })
);

router.post(
  '/clerk',
  [body('token').notEmpty().withMessage('Clerk session token required')],
  validate,
  asyncHandler(async (req, res) => {
    const claims = await verifyClerkSessionToken(req.body.token);
    const user = await findOrCreateClerkUser({
      clerkId: claims.clerkId,
      email: claims.email,
      name: claims.name || nameFromEmail(claims.email),
      emailVerified: claims.emailVerified,
      googleId: claims.googleId,
    });
    await startSession(req, res, user.id);
    res.json({
      success: true,
      message: 'Signed in with Clerk',
      data: { user },
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
    await startSession(req, res, user.id);
    res.json({
      success: true,
      message: 'Signed in with Firebase',
      data: { user },
    });
  })
);

router.get('/session', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const user = await sessionUser(req);
  res.json({ success: true, data: { user } });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  await endSession(req, res);
  res.json({ success: true });
}));

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = req.user;
    res.json({ success: true, data: { user } });
  })
);

router.put(
  '/me',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('password').optional().isString().isByteLength({ max: 72 }).isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
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

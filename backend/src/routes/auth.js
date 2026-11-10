import { resetPasswordWithEmailLink } from '../services/passwordRecovery.js';
import { Router } from 'express';
import {
  startSession,
  endSession,
  sessionUser,
  revokeAllUserSessions,
} from '../services/sessionService.js';
import { body } from 'express-validator';
import { config } from '../config.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  loginLimiter,
  registerLimiter,
  resetLimiter,
  oauthBridgeLimiter,
} from '../middleware/authRateLimit.js';
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
import { prisma } from '../db/prisma.js';

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
const passwordField = (message = 'Use at least 8 characters and at most 72 bytes for your password') => (
  body('password').isString().isLength({ min: 8 }).isByteLength({ max: 72 }).withMessage(message)
);

router.post('/reset-password', resetLimiter, [
  emailField(),
  body('code').isString().isLength({ min: 1, max: 2048 }),
  passwordField(),
], validate, asyncHandler(async (req, res) => {
  const { email, code, password } = req.body;
  await resetPasswordWithEmailLink(email, code, password);
  res.json({ success: true });
}));

router.post('/register', registerLimiter, [
  emailField(),
  passwordField(),
], validate, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await createUser({ email, password, name: nameFromEmail(email) });
  await startSession(req, res, user.id);
  res.status(201).json({ success: true, data: { user } });
}));

router.post('/login', loginLimiter, [
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
        // Firebase bridge is disabled while Clerk is the primary Google provider.
        firebase: Boolean(config.firebaseProjectId) && !config.clerkEnabled,
        google: config.clerkEnabled || Boolean(config.firebaseProjectId),
        projectId: config.firebaseProjectId || null,
      },
    });
  })
);

router.post(
  '/clerk',
  oauthBridgeLimiter,
  [body('token').notEmpty().withMessage('Clerk session token required')],
  validate,
  asyncHandler(async (req, res) => {
    const claims = await verifyClerkSessionToken(req.body.token);
    const user = await findOrCreateClerkUser({
      clerkId: claims.clerkId,
      email: claims.email,
      name: claims.name || nameFromEmail(claims.email),
      emailVerified: claims.emailVerified,
      googleVerified: claims.googleVerified,
      googleId: claims.googleId,
      avatarUrl: claims.avatarUrl,
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
  oauthBridgeLimiter,
  [body('idToken').notEmpty().withMessage('Firebase ID token required')],
  validate,
  asyncHandler(async (req, res) => {
    if (config.clerkEnabled) {
      return res.status(410).json({
        success: false,
        message: 'Firebase sign-in is disabled. Continue with Google through Clerk instead.',
      });
    }
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
    body('password').optional().isString().isByteLength({ max: 72 }).isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('currentPassword').optional().isString().isLength({ min: 1, max: 72 }),
    body('avatarUrl').optional({ nullable: true }).isString().isLength({ max: 2048 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const wantsPasswordChange = Boolean(req.body.password);
    if (wantsPasswordChange) {
      if (!req.body.currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Enter your current password to set a new one.',
        });
      }
      const account = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!await verifyPassword(account, req.body.currentPassword)) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect.',
        });
      }
    }

    const user = await updateUser(req.user.id, {
      name: req.body.name,
      password: req.body.password,
      avatarUrl: req.body.avatarUrl,
    });

    if (wantsPasswordChange) {
      await revokeAllUserSessions(req.user.id);
      await startSession(req, res, req.user.id);
    }

    res.json({ success: true, data: { user } });
  })
);

export default router;

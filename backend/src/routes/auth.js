import { requestPasswordReset, resetPasswordWithToken } from '../services/passwordRecovery.js';
import { Router } from 'express';
import {
  startSession,
  endSession,
  sessionUser,
  sessionId,
  revokeAllUserSessions,
  revokeUserSession,
  revokeOtherUserSessions,
  listUserSessions,
} from '../services/sessionService.js';
import { body, param } from 'express-validator';
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
  consumeAuthToken,
  sendEmailVerification,
} from '../services/authTokenService.js';
import { isMailConfigured } from '../services/mailService.js';
import {
  createUser,
  findUserByEmail,
  verifyPassword,
  findOrCreateFirebaseUser,
  findOrCreateClerkUser,
  getUserById,
  updateUser,
  markEmailVerified,
  isEmailVerified,
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

function requireMailConfigured(res) {
  if (isMailConfigured()) return false;
  res.status(503).json({
    success: false,
    message: 'Email delivery is not configured. Set RESEND_API_KEY and MAIL_FROM before using email verification or password recovery.',
    code: 'mail_not_configured',
  });
  return true;
}

router.post('/forgot-password', resetLimiter, [
  emailField(),
], validate, asyncHandler(async (req, res) => {
  if (requireMailConfigured(res)) return;
  await requestPasswordReset(req.body.email);
  // Generic success only after mail layer is configured (unknown emails still look the same).
  res.json({
    success: true,
    message: 'If an account exists for that email, a reset link has been sent.',
  });
}));

router.post('/reset-password', resetLimiter, [
  emailField(),
  body('token').isString().isLength({ min: 64, max: 128 }),
  passwordField(),
], validate, asyncHandler(async (req, res) => {
  const { email, token, password } = req.body;
  await resetPasswordWithToken(email, token, password);
  res.json({ success: true, message: 'Password updated. Sign in with your new password.' });
}));

router.post('/register', registerLimiter, [
  emailField(),
  passwordField(),
], validate, asyncHandler(async (req, res) => {
  if (requireMailConfigured(res)) return;

  const { email, password } = req.body;
  const user = await createUser({
    email,
    password,
    name: nameFromEmail(email),
    emailVerifiedAt: null,
  });

  try {
    const sent = await sendEmailVerification({ id: user.id, email: user.email });
    res.status(201).json({
      success: true,
      message: 'Check your email to verify your account before signing in.',
      data: {
        needsVerification: true,
        email: user.email,
        ...(config.authTestReturnToken && sent.token ? { token: sent.token } : {}),
      },
    });
  } catch (error) {
    // Leave the unverified account in place for a later resend once mail works.
    if (error.status === 503) {
      return res.status(503).json({
        success: false,
        message: error.message,
        code: error.code || 'mail_not_configured',
        data: { needsVerification: true, email: user.email },
      });
    }
    throw error;
  }
}));

router.post('/resend-verification', resetLimiter, [
  emailField(),
], validate, asyncHandler(async (req, res) => {
  if (requireMailConfigured(res)) return;

  const email = String(req.body.email).toLowerCase().trim();
  const account = await findUserByEmail(email);
  const googleOnly = !account?.password
    || account.password === 'GOOGLE_ONLY'
    || account.password.startsWith('GOOGLE_ONLY');
  if (account && !isEmailVerified(account) && !googleOnly) {
    await sendEmailVerification(account);
  }

  res.json({
    success: true,
    message: 'If that account needs verification, a new email has been sent.',
  });
}));

router.post('/verify-email', resetLimiter, [
  emailField(),
  body('token').isString().isLength({ min: 64, max: 128 }),
], validate, asyncHandler(async (req, res) => {
  const user = await consumeAuthToken({
    email: req.body.email,
    token: req.body.token,
    type: 'EMAIL_VERIFY',
  });
  const verified = await markEmailVerified(user.id);
  await startSession(req, res, verified.id);
  res.json({
    success: true,
    message: 'Email verified. You are signed in.',
    data: { user: verified },
  });
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

  if (!isEmailVerified(account)) {
    return res.status(401).json({
      success: false,
      message: 'Verify your email before signing in. Check your inbox or resend the verification link.',
      code: 'email_unverified',
      data: { email: account.email, needsVerification: true },
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
        firebase: config.firebaseEnabled,
        google: config.clerkEnabled || config.firebaseEnabled,
        mailConfigured: isMailConfigured(),
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
    if (!config.clerkEnabled) return res.status(410).json({ message: 'Clerk sign-in is disabled.' });
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
    if (!config.firebaseEnabled) {
      return res.status(410).json({
        success: false,
        message: 'Firebase sign-in is unavailable.',
      });
    }
    const claims = await verifyFirebaseIdToken(req.body.idToken);
    const user = await findOrCreateFirebaseUser({
      firebaseUid: claims.uid,
      googleId: claims.googleId,
      email: claims.email,
      name: claims.name || nameFromEmail(claims.email),
      signInProvider: claims.signInProvider,
      emailVerified: true,
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

router.get(
  '/sessions',
  authenticate,
  asyncHandler(async (req, res) => {
    const current = sessionId(req);
    const sessions = await listUserSessions(req.user.id, current);
    res.json({ success: true, data: { sessions } });
  })
);

router.delete(
  '/sessions/:id',
  authenticate,
  [param('id').isString().isLength({ min: 16, max: 128 })],
  validate,
  asyncHandler(async (req, res) => {
    const current = sessionId(req);
    if (req.params.id === current) {
      await endSession(req, res);
      return res.json({ success: true, message: 'Current session signed out.' });
    }
    const count = await revokeUserSession(req.user.id, req.params.id);
    if (!count) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }
    res.json({ success: true });
  })
);

router.post(
  '/sessions/revoke-all',
  authenticate,
  asyncHandler(async (req, res) => {
    const current = sessionId(req);
    const keepCurrent = req.body?.keepCurrent !== false;
    if (keepCurrent && current) {
      await revokeOtherUserSessions(req.user.id, current);
      return res.json({ success: true, message: 'Signed out of other devices.' });
    }
    await revokeAllUserSessions(req.user.id);
    await startSession(req, res, req.user.id);
    res.json({ success: true, message: 'All other sessions revoked.' });
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

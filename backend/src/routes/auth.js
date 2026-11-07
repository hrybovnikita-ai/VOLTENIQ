import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import { config } from '../config.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { verifyFirebaseIdToken } from '../utils/firebaseAuth.js';
import {
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

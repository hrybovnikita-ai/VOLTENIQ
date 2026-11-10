import { sessionUser, startSession } from '../services/sessionService.js';
import { config } from '../config.js';
import { verifyClerkSessionToken } from '../utils/clerkAuth.js';
import { findOrCreateClerkUser } from '../services/userService.js';

function bearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function authenticate(req, res, next) {
  try {
    req.user = await sessionUser(req);
    if (req.user) return next();

    const token = bearerToken(req);
    if (token && config.clerkEnabled) {
      const claims = await verifyClerkSessionToken(token);
      const user = await findOrCreateClerkUser({
        clerkId: claims.clerkId,
        email: claims.email,
        name: claims.name,
        emailVerified: claims.emailVerified,
        googleId: claims.googleId,
        avatarUrl: claims.avatarUrl,
      });
      await startSession(req, res, user.id);
      req.user = user;
      return next();
    }

    return res.status(401).json({ success: false, message: 'Authentication required' });
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (error.status === 409) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}

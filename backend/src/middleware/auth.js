import { sessionUser } from '../services/sessionService.js';

export async function authenticate(req, res, next) {
  try {
    req.user = await sessionUser(req);
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}

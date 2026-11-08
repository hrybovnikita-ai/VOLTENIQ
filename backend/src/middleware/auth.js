import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getUserById } from '../services/userService.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const payload = jwt.verify(token, config.jwtSecret);
    const user = await getUserById(payload.userId);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    next();
  } catch (error) {
    if (!(error instanceof jwt.JsonWebTokenError)) return next(error);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.userId, role: payload.role, email: payload.email, name: payload.name };
  } catch {
    // ignore invalid token for optional routes
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}

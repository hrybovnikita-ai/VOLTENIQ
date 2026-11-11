import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { config } from '../config.js';

export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 14 * 24 * 60 * 60 * 1000;
const LAST_SEEN_TOUCH_MS = 5 * 60 * 1000;

const secure = config.nodeEnv === 'production' || config.isVercel;
const crossSite = process.env.SESSION_SAME_SITE === 'none';

// Same-origin production (frontend + /api rewrite) uses __Host- cookies.
// Cross-site only: set SESSION_SAME_SITE=none (requires Secure; cannot use __Host-).
export const SESSION_COOKIE_NAME = secure && !crossSite
  ? '__Host-volteniq_session'
  : 'volteniq_session';

const cookieOptions = {
  httpOnly: true,
  secure,
  path: '/',
  sameSite: crossSite ? 'none' : 'lax',
};

const digest = (token) => createHash('sha256').update(token).digest('hex');

function readSessionToken(req) {
  const header = req.headers.cookie || '';
  const entry = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!entry) return null;

  let token = entry.slice(SESSION_COOKIE_NAME.length + 1);
  try {
    token = decodeURIComponent(token);
  } catch {
    return null;
  }
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export function sessionId(req) {
  const token = readSessionToken(req);
  return token ? digest(token) : null;
}

function clientMeta(req) {
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 512) || null;
  const ip = String(req.ip || req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim()
    .slice(0, 64) || null;
  return { userAgent, ip };
}

export async function startSession(req, res, userId) {
  const token = randomBytes(32).toString('hex');
  const previous = sessionId(req);
  const now = new Date();
  const meta = clientMeta(req);

  await prisma.$transaction([
    prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: now } },
          { lastSeenAt: { lte: new Date(now.getTime() - SESSION_IDLE_MS) } },
          ...(previous ? [{ id: previous }] : []),
        ],
      },
    }),
    prisma.session.create({
      data: {
        id: digest(token),
        userId,
        createdAt: now,
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS),
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
    }),
  ]);

  res.cookie(SESSION_COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: SESSION_LIFETIME_MS,
  });
}

export async function endSession(req, res) {
  const id = sessionId(req);
  if (id) await prisma.session.deleteMany({ where: { id } });
  res.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
}

/** Revoke every store session for a user (password change / recovery). */
export async function revokeAllUserSessions(userId) {
  if (!userId) return;
  await prisma.session.deleteMany({ where: { userId } });
}

export async function revokeUserSession(userId, targetId, { exceptId = null } = {}) {
  if (!userId || !targetId) return 0;
  if (exceptId && targetId === exceptId) return 0;
  const result = await prisma.session.deleteMany({
    where: { id: targetId, userId },
  });
  return result.count;
}

export async function revokeOtherUserSessions(userId, currentId) {
  if (!userId) return 0;
  const result = await prisma.session.deleteMany({
    where: {
      userId,
      ...(currentId ? { id: { not: currentId } } : {}),
    },
  });
  return result.count;
}

export async function listUserSessions(userId, currentId) {
  const now = new Date();
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      expiresAt: { gt: now },
      lastSeenAt: { gt: new Date(now.getTime() - SESSION_IDLE_MS) },
    },
    orderBy: { lastSeenAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
      userAgent: true,
      ip: true,
    },
  });

  return sessions.map((session) => ({
    id: session.id,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
    userAgent: session.userAgent,
    ip: session.ip,
    current: session.id === currentId,
  }));
}

export async function sessionUser(req) {
  const id = sessionId(req);
  if (!id) return null;

  const now = new Date();
  const session = await prisma.session.findFirst({
    where: { id, expiresAt: { gt: now } },
    select: {
      id: true,
      lastSeenAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
          emailVerifiedAt: true,
          googleId: true,
          clerkId: true,
        },
      },
    },
  });

  if (!session?.user) return null;

  if (session.lastSeenAt.getTime() <= now.getTime() - SESSION_IDLE_MS) {
    await prisma.session.deleteMany({ where: { id } });
    return null;
  }

  // Drop legacy cookie sessions for unverified password-only accounts.
  // OAuth users are marked verified when Google proves email ownership.
  if (!session.user.emailVerifiedAt && !session.user.googleId && !session.user.clerkId) {
    await prisma.session.deleteMany({ where: { id } });
    return null;
  }

  if (now.getTime() - session.lastSeenAt.getTime() >= LAST_SEEN_TOUCH_MS) {
    await prisma.session.update({
      where: { id },
      data: { lastSeenAt: now },
    }).catch(() => {});
  }

  const { googleId, clerkId, ...safeUser } = session.user;
  return {
    ...safeUser,
    emailVerifiedAt: session.user.emailVerifiedAt,
    hasGoogle: Boolean(googleId),
    hasClerk: Boolean(clerkId),
  };
}

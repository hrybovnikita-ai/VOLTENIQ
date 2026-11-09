import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { config } from '../config.js';

export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

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

function sessionId(req) {
  const token = readSessionToken(req);
  return token ? digest(token) : null;
}

export async function startSession(req, res, userId) {
  const token = randomBytes(32).toString('hex');
  const previous = sessionId(req);
  const now = new Date();

  await prisma.$transaction([
    prisma.session.deleteMany({
      where: {
        OR: [{ expiresAt: { lte: now } }, ...(previous ? [{ id: previous }] : [])],
      },
    }),
    prisma.session.create({
      data: {
        id: digest(token),
        userId,
        expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS),
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

export async function sessionUser(req) {
  const id = sessionId(req);
  if (!id) return null;

  const session = await prisma.session.findFirst({
    where: { id, expiresAt: { gt: new Date() } },
    select: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return session?.user || null;
}

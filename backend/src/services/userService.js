import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../db/prisma.js';

function sanitize(user) {
  if (!user) return null;
  const { id, name, email, avatarUrl, role, createdAt, updatedAt } = user;
  return { id, name, email, avatarUrl: avatarUrl || null, role, createdAt, updatedAt };
}

export async function findUserByEmail(email) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export async function findUserByGoogleId(googleId) {
  return prisma.user.findFirst({ where: { googleId } });
}

export async function findUserByFirebaseUid(firebaseUid) {
  return prisma.user.findFirst({ where: { firebaseUid } });
}

export async function findUserByClerkId(clerkId) {
  return prisma.user.findFirst({ where: { clerkId } });
}

export async function getUserById(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  return sanitize(user);
}

export async function createUser({
  name,
  email,
  password,
  googleId = null,
  firebaseUid = null,
  clerkId = null,
  avatarUrl = null,
}) {
  const hashed = password
    ? await bcrypt.hash(password, 10)
    : await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

  try {
    // Omit role entirely so PostgreSQL supplies USER. The API login cannot grant roles.
    const [user] = await prisma.$queryRaw`
      INSERT INTO public."User" (id, name, email, password, "googleId", "firebaseUid", "clerkId", "avatarUrl", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${name}, ${email.toLowerCase()}, ${hashed}, ${googleId}, ${firebaseUid}, ${clerkId}, ${avatarUrl}, CURRENT_TIMESTAMP)
      RETURNING id, name, email, "avatarUrl", "googleId", "firebaseUid", "clerkId", role::text AS role, "createdAt", "updatedAt"
    `;
    return sanitize(user);
  } catch (error) {
    if (error.code === 'P2010' && error.meta?.code === '23505') {
      const err = new Error('Email already registered');
      err.status = 409;
      throw err;
    }
    throw error;
  }
}

/**
 * Link a verified Clerk identity to an existing Prisma user by email, or create one.
 * Never deletes users and never creates a second row for the same email.
 * Requires a verified email from Clerk to prevent account takeover.
 */
export async function findOrCreateClerkUser({
  clerkId,
  email,
  name,
  emailVerified = false,
  googleId = null,
  avatarUrl = null,
}) {
  if (!clerkId || !email) {
    const err = new Error('Clerk account email is required');
    err.status = 400;
    throw err;
  }
  if (!emailVerified) {
    const err = new Error('Verify your email with Google/Clerk before continuing');
    err.status = 401;
    throw err;
  }

  const existingByClerk = await findUserByClerkId(clerkId);
  if (existingByClerk) {
    if (existingByClerk.email.toLowerCase() !== email.toLowerCase()) {
      const err = new Error('This Clerk account is already linked to a different email');
      err.status = 409;
      throw err;
    }
    const patch = {};
    if (name && !existingByClerk.name) patch.name = name;
    if (googleId && !existingByClerk.googleId) patch.googleId = googleId;
    if (avatarUrl) patch.avatarUrl = avatarUrl;
    if (Object.keys(patch).length) {
      const updated = await prisma.user.update({
        where: { id: existingByClerk.id },
        data: patch,
      });
      return sanitize(updated);
    }
    return sanitize(existingByClerk);
  }

  const existingByEmail = await findUserByEmail(email);
  if (existingByEmail) {
    if (existingByEmail.clerkId && existingByEmail.clerkId !== clerkId) {
      const err = new Error('This email is already linked to another Clerk account');
      err.status = 409;
      throw err;
    }

    // Verified Google/Clerk email may link to the existing store row (no duplicate).
    const updated = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        clerkId,
        ...(googleId && !existingByEmail.googleId ? { googleId } : {}),
        ...(name && !existingByEmail.name ? { name } : {}),
        ...(avatarUrl ? { avatarUrl } : {}),
      },
    });
    return sanitize(updated);
  }

  return createUser({
    name: name || email.split('@')[0],
    email,
    password: null,
    clerkId,
    googleId,
    avatarUrl,
  });
}

export async function findOrCreateFirebaseUser({
  firebaseUid,
  email,
  name,
  signInProvider = null,
}) {
  if (!firebaseUid || !email) {
    const err = new Error('Firebase account email is required');
    err.status = 400;
    throw err;
  }

  const isGoogle = signInProvider === 'google.com';
  let user = await findUserByFirebaseUid(firebaseUid);
  if (!user && isGoogle) {
    user = await findUserByGoogleId(firebaseUid);
  }
  if (!user) {
    const byEmail = await findUserByEmail(email);
    if (byEmail) {
      // Link Firebase/Google to the existing store account instead of duplicating.
      const updated = await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          firebaseUid,
          ...(isGoogle ? { googleId: firebaseUid } : {}),
          ...(name ? { name } : {}),
        },
      });
      return sanitize(updated);
    }
  }

  if (user) {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        firebaseUid,
        ...(isGoogle ? { googleId: firebaseUid } : {}),
        ...(name ? { name } : {}),
      },
    });
    return sanitize(updated);
  }

  return createUser({
    name: name || email.split('@')[0],
    email,
    password: null,
    googleId: isGoogle ? firebaseUid : null,
    firebaseUid,
  });
}

export async function verifyPassword(user, password) {
  if (!user?.password || !password || Buffer.byteLength(password, 'utf8') > 72) return false;
  if (user.googleId && user.password?.startsWith('GOOGLE_ONLY')) return false;
  return bcrypt.compare(password, user.password);
}

export async function updateUser(id, data) {
  const update = {};
  if (data.name) update.name = data.name;
  if (data.password) update.password = await bcrypt.hash(data.password, 10);
  if (data.avatarUrl !== undefined) {
    update.avatarUrl = data.avatarUrl ? String(data.avatarUrl).slice(0, 2048) : null;
  }

  const user = await prisma.user.update({ where: { id }, data: update });
  return sanitize(user);
}

export async function listUsers() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return users.map(sanitize);
}

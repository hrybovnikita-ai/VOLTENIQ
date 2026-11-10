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
    ? await bcrypt.hash(password, 12)
    : await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

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

function identityConflict(message) {
  const err = new Error(message);
  err.status = 409;
  return err;
}

/**
 * After Google OAuth proves control of the email (and Google subject when present),
 * an existing store row may adopt a newer Clerk user id. Blind email-only merges
 * without that proof remain rejected.
 */
function canAdoptClerkId(existing, { clerkId, googleId, googleVerified }) {
  if (!existing.clerkId || existing.clerkId === clerkId) return true;
  if (!googleVerified || !googleId) return false;
  if (existing.googleId && existing.googleId !== googleId) return false;
  return true;
}

function profilePatch(existing, { name, googleId, avatarUrl }) {
  const patch = {};
  if (name && !existing.name) patch.name = name;
  if (googleId && !existing.googleId) patch.googleId = googleId;
  if (avatarUrl) patch.avatarUrl = avatarUrl;
  return patch;
}

async function attachClerkIdentity(existing, {
  clerkId,
  email,
  name,
  googleId = null,
  avatarUrl = null,
  googleVerified = false,
}) {
  if (existing.email.toLowerCase() !== email.toLowerCase()) {
    throw identityConflict('This identity is already linked to a different email');
  }

  if (googleId && existing.googleId && existing.googleId !== googleId) {
    throw identityConflict('This Google account does not match the linked store account');
  }

  if (!canAdoptClerkId(existing, { clerkId, googleId, googleVerified })) {
    throw identityConflict('This email is already linked to another Clerk account');
  }

  const taken = await findUserByClerkId(clerkId);
  if (taken && taken.id !== existing.id) {
    throw identityConflict('This Clerk account is already linked to a different store user');
  }

  const data = {
    ...profilePatch(existing, { name, googleId, avatarUrl }),
  };
  if (existing.clerkId !== clerkId) data.clerkId = clerkId;

  if (!Object.keys(data).length) return sanitize(existing);

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data,
  });
  return sanitize(updated);
}

/**
 * Link a verified Clerk identity to an existing Prisma user, or create one.
 * Never deletes users and never creates a second row for the same email.
 * Requires a verified email; clerkId replacement requires verified Google ownership.
 */
export async function findOrCreateClerkUser({
  clerkId,
  email,
  name,
  emailVerified = false,
  googleVerified = false,
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

  const claims = { clerkId, email, name, googleId, avatarUrl, googleVerified };

  const existingByClerk = await findUserByClerkId(clerkId);
  if (existingByClerk) {
    return attachClerkIdentity(existingByClerk, claims);
  }

  if (googleId) {
    const existingByGoogle = await findUserByGoogleId(googleId);
    if (existingByGoogle) {
      return attachClerkIdentity(existingByGoogle, claims);
    }
  }

  const existingByEmail = await findUserByEmail(email);
  if (existingByEmail) {
    return attachClerkIdentity(existingByEmail, claims);
  }

  try {
    return await createUser({
      name: name || email.split('@')[0],
      email,
      password: null,
      clerkId,
      googleId,
      avatarUrl,
    });
  } catch (error) {
    if (error.status !== 409) throw error;
    const concurrent = await findUserByClerkId(clerkId);
    if (concurrent?.email.toLowerCase() === email.toLowerCase()) return sanitize(concurrent);
    const byEmail = await findUserByEmail(email);
    if (byEmail) return attachClerkIdentity(byEmail, claims);
    throw error;
  }
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

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('volteniq-timing-pad', 10);

export async function verifyPassword(user, password) {
  if (!password || Buffer.byteLength(password, 'utf8') > 72) {
    await bcrypt.compare(password || 'invalid', DUMMY_PASSWORD_HASH);
    return false;
  }
  if (!user?.password) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    return false;
  }
  if (user.googleId && user.password?.startsWith('GOOGLE_ONLY')) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    return false;
  }
  return bcrypt.compare(password, user.password);
}

function sanitizeAvatarUrl(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim().slice(0, 2048);
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function updateUser(id, data) {
  const update = {};
  if (data.name) update.name = data.name;
  if (data.password) update.password = await bcrypt.hash(data.password, 12);
  if (data.avatarUrl !== undefined) {
    update.avatarUrl = sanitizeAvatarUrl(data.avatarUrl);
  }

  const user = await prisma.user.update({ where: { id }, data: update });
  return sanitize(user);
}

export async function listUsers() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return users.map(sanitize);
}

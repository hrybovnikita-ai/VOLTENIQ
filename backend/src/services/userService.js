import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../db/prisma.js';

function sanitize(user) {
  if (!user) return null;
  const {
    id,
    name,
    email,
    avatarUrl,
    role,
    createdAt,
    updatedAt,
    emailVerifiedAt,
    googleId,
    clerkId,
  } = user;
  return {
    id,
    name,
    email,
    avatarUrl: avatarUrl || null,
    role,
    createdAt,
    updatedAt,
    emailVerifiedAt: emailVerifiedAt || null,
    emailVerified: Boolean(emailVerifiedAt),
    hasGoogle: Boolean(googleId),
    hasClerk: Boolean(clerkId),
  };
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

export function isEmailVerified(user) {
  return Boolean(user?.emailVerifiedAt);
}

/** Sentinel for OAuth-only accounts — not a bcrypt hash; password login always fails. */
export const GOOGLE_ONLY_PASSWORD = 'GOOGLE_ONLY';

function isGoogleOnlyPassword(value) {
  return !value || value === GOOGLE_ONLY_PASSWORD || String(value).startsWith('GOOGLE_ONLY');
}

export async function createUser({
  name,
  email,
  password,
  googleId = null,
  firebaseUid = null,
  clerkId = null,
  avatarUrl = null,
  emailVerifiedAt = null,
}) {
  const hashed = password
    ? await bcrypt.hash(password, 12)
    : GOOGLE_ONLY_PASSWORD;

  try {
    // Omit role entirely so PostgreSQL supplies USER. The API login cannot grant roles.
    const [user] = await prisma.$queryRaw`
      INSERT INTO public."User" (
        id, name, email, password, "emailVerifiedAt", "googleId", "firebaseUid", "clerkId", "avatarUrl", "updatedAt"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${name},
        ${email.toLowerCase()},
        ${hashed},
        ${emailVerifiedAt},
        ${googleId},
        ${firebaseUid},
        ${clerkId},
        ${avatarUrl},
        CURRENT_TIMESTAMP
      )
      RETURNING
        id, name, email, "avatarUrl", "googleId", "firebaseUid", "clerkId",
        "emailVerifiedAt", role::text AS role, "createdAt", "updatedAt"
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

  // Email-row attach/reclaim requires verified Google ownership of this exact email.
  if (!googleVerified || !googleId) {
    throw identityConflict('Verified Google ownership is required to link this account');
  }

  if (existing.googleId && existing.googleId !== googleId) {
    throw identityConflict('This Google account does not match the linked store account');
  }

  if ((!existing.emailVerifiedAt && existing.googleId !== googleId) || (existing.clerkId && existing.clerkId !== clerkId)) {
    throw identityConflict('Verify your email or use the original linked identity.');
  }

  const data = {
    ...profilePatch(existing, { name, googleId, avatarUrl }),
    // Provider just proved ownership of this email — mark verified now (not via ID backfill).
    emailVerifiedAt: existing.emailVerifiedAt || new Date(),
  };
  if (existing.clerkId !== clerkId) data.clerkId = clerkId;

  const updated = await prisma.user.update({
    where: { id: existing.id, AND: [{ clerkId: existing.clerkId }, { googleId: existing.googleId }] },
    data,
  });
  return sanitize(updated);
}

/**
 * Link a verified Clerk/Google identity to an existing Prisma user, or create one.
 * Never deletes users and never creates a second row for the same email.
 * Never merges by email alone — Google verification of the matching subject is required.
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
    // Same Clerk user returning — refresh profile; set verified only when Google proves it.
    if (existingByClerk.email.toLowerCase() !== email.toLowerCase()) {
      throw identityConflict('This Clerk account is already linked to a different email');
    }
    if (existingByClerk.googleId && googleId && existingByClerk.googleId !== googleId) throw identityConflict('Google identity conflict');
    const data = {
      ...profilePatch(existingByClerk, { name, googleId, avatarUrl }),
    };
    if (googleVerified && googleId) {
      data.emailVerifiedAt = existingByClerk.emailVerifiedAt || new Date();
      if (!existingByClerk.googleId) data.googleId = googleId;
    }
    if (!Object.keys(data).length) return sanitize(existingByClerk);
    const updated = await prisma.user.update({
      where: { id: existingByClerk.id, AND: [{ googleId: existingByClerk.googleId }] },
      data,
    });
    return sanitize(updated);
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

  if (!googleVerified || !googleId) {
    const err = new Error('Verified Google ownership is required to create this account');
    err.status = 401;
    throw err;
  }

  try {
    return await createUser({
      name: name || email.split('@')[0],
      email,
      password: null,
      clerkId,
      googleId,
      avatarUrl,
      emailVerifiedAt: new Date(),
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

export async function findOrCreateFirebaseUser({ firebaseUid, googleId, email, name, signInProvider, emailVerified }) {
  if (!firebaseUid || !googleId || !email || signInProvider !== 'google.com' || emailVerified !== true) {
    throw Object.assign(new Error('Verified Google identity is required'), { status: 401 });
  }
  const address = email.trim().toLowerCase();

  async function reclaimUnverifiedPasswordAccount(user) {
    // Verified Google ownership of this exact email may reclaim an unverified password row.
    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: {
          id: user.id, email: address, emailVerifiedAt: null,
          AND: [{ firebaseUid: null }, { googleId: null }, { clerkId: null }],
        },
        data: {
          password: GOOGLE_ONLY_PASSWORD, firebaseUid, googleId, emailVerifiedAt: new Date(),
          ...(name && !user.name ? { name } : {}),
        },
      }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
      prisma.authToken.deleteMany({ where: { userId: user.id } }),
    ]);
    return sanitize(updated);
  }

  async function attach(user) {
    // Older Firebase accounts stored the Firebase UID in googleId. Preserve that binding.
    const legacy = user.firebaseUid === firebaseUid && user.googleId === firebaseUid;
    if (user.email !== address) {
      throw identityConflict('Account identity conflict. Use your original sign-in method or verify your email.');
    }
    if (user.firebaseUid && user.firebaseUid !== firebaseUid) {
      throw identityConflict('Account identity conflict. Use your original sign-in method or verify your email.');
    }
    if (user.googleId && user.googleId !== googleId && !legacy) {
      throw identityConflict('Account identity conflict. Use your original sign-in method or verify your email.');
    }
    // Clerk-only rows may link only when their email ownership was already
    // verified; Google now proves ownership of the same address.
    if (user.clerkId && !user.googleId && !user.firebaseUid && !user.emailVerifiedAt) {
      throw identityConflict('Account identity conflict. Use your original sign-in method or verify your email.');
    }

    // Unverified password-only accounts: reclaim with matching Google proof (never email-only merge).
    if (!user.emailVerifiedAt && !user.googleId && !user.firebaseUid) {
      try {
        return await reclaimUnverifiedPasswordAccount(user);
      } catch (error) {
        if (error.code === 'P2025') {
          throw identityConflict('The account is linked to a different identity.');
        }
        throw error;
      }
    }

    if (!user.emailVerifiedAt && user.firebaseUid !== firebaseUid && user.googleId !== googleId) {
      throw identityConflict('Account identity conflict. Use your original sign-in method or verify your email.');
    }

    try {
      const updated = await prisma.user.update({
        where: {
          id: user.id,
          email: address,
          AND: [
            { firebaseUid: user.firebaseUid },
            { googleId: user.googleId },
            { clerkId: user.clerkId },
          ],
        },
        data: {
          firebaseUid,
          googleId: user.googleId || googleId,
          emailVerifiedAt: user.emailVerifiedAt || new Date(),
          ...(name && !user.name ? { name } : {}),
        },
      });
      return sanitize(updated);
    } catch (error) {
      if (['P2002', 'P2025'].includes(error.code)) {
        const linked = await findUserByFirebaseUid(firebaseUid);
        if (linked?.email === address && [googleId, firebaseUid].includes(linked.googleId)) {
          return sanitize(linked);
        }
        throw identityConflict('The account is linked to a different identity.');
      }
      throw error;
    }
  }

  const existing = await findUserByFirebaseUid(firebaseUid)
    || await findUserByGoogleId(googleId)
    || await findUserByEmail(address);
  if (existing) return attach(existing);

  try {
    return await createUser({
      name: name || address.split('@')[0],
      email: address,
      firebaseUid,
      googleId,
      emailVerifiedAt: new Date(),
    });
  } catch (error) {
    if (error.status !== 409) throw error;
    const concurrent = await findUserByEmail(address);
    if (concurrent) return attach(concurrent);
    throw error;
  }
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
  if (isGoogleOnlyPassword(user.password)) {
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

export async function markEmailVerified(userId) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
  });
  return sanitize(user);
}

export async function listUsers() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return users.map(sanitize);
}

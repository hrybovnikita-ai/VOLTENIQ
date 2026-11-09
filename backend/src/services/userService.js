import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../db/prisma.js';

function sanitize(user) {
  if (!user) return null;
  const { id, name, email, role, createdAt, updatedAt } = user;
  return { id, name, email, role, createdAt, updatedAt };
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
}) {
  const hashed = password
    ? await bcrypt.hash(password, 10)
    : await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);


  try {
    // Omit role entirely so PostgreSQL supplies USER. The API login cannot grant roles.
    const [user] = await prisma.$queryRaw`
      INSERT INTO public."User" (id, name, email, password, "googleId", "firebaseUid", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${name}, ${email.toLowerCase()}, ${hashed}, ${googleId}, ${firebaseUid}, CURRENT_TIMESTAMP)
      RETURNING id, name, email, "googleId", "firebaseUid", role::text AS role, "createdAt", "updatedAt"
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
    if (await findUserByEmail(email)) {
      const err = new Error('This email already has an account. Use its original sign-in method.');
      err.status = 409;
      throw err;
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

  const user = await prisma.user.update({ where: { id }, data: update });
  return sanitize(user);
}

export async function listUsers() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return users.map(sanitize);
}

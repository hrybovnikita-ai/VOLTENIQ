import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config.js';
import { prisma } from '../db/prisma.js';
import { createId, getDemoStore } from '../db/demoStore.js';

function sanitize(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

export async function findUserByEmail(email) {
  if (config.demoMode) {
    const store = await getDemoStore();
    return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export async function findUserByGoogleId(googleId) {
  if (config.demoMode) {
    const store = await getDemoStore();
    return store.users.find((u) => u.googleId === googleId) || null;
  }
  return prisma.user.findFirst({ where: { googleId } });
}

export async function findUserByFirebaseUid(firebaseUid) {
  if (config.demoMode) {
    const store = await getDemoStore();
    return store.users.find((u) => u.firebaseUid === firebaseUid) || null;
  }
  return prisma.user.findFirst({ where: { firebaseUid } });
}

export async function getUserById(id) {
  if (config.demoMode) {
    const store = await getDemoStore();
    return sanitize(store.users.find((u) => u.id === id));
  }
  const user = await prisma.user.findUnique({ where: { id } });
  return sanitize(user);
}

export async function createUser({
  name,
  email,
  password,
  role = 'USER',
  googleId = null,
  firebaseUid = null,
}) {
  const hashed = password
    ? await bcrypt.hash(password, 10)
    : await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

  if (config.demoMode) {
    const store = await getDemoStore();
    if (store.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      const err = new Error('Email already registered');
      err.status = 409;
      throw err;
    }
    const user = {
      id: createId(),
      name,
      email: email.toLowerCase(),
      password: hashed,
      googleId,
      firebaseUid,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.users.push(user);
    return sanitize(user);
  }

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashed,
        googleId,
        firebaseUid,
        role,
      },
    });
    return sanitize(user);
  } catch (error) {
    if (error.code === 'P2002') {
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
    user = await findUserByEmail(email);
  }

  if (user) {
    if (config.demoMode) {
      const store = await getDemoStore();
      const existing = store.users.find((u) => u.id === user.id);
      existing.firebaseUid = firebaseUid;
      if (isGoogle) existing.googleId = firebaseUid;
      if (name && (!existing.name || existing.name === existing.email.split('@')[0])) {
        existing.name = name;
      }
      existing.updatedAt = new Date().toISOString();
      return sanitize(existing);
    }

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
  if (!user?.password || !password) return false;
  if (user.googleId && user.password?.startsWith('GOOGLE_ONLY')) return false;
  return bcrypt.compare(password, user.password);
}

export async function updateUser(id, data) {
  if (config.demoMode) {
    const store = await getDemoStore();
    const user = store.users.find((u) => u.id === id);
    if (!user) return null;
    if (data.name) user.name = data.name;
    if (data.password) user.password = await bcrypt.hash(data.password, 10);
    user.updatedAt = new Date().toISOString();
    return sanitize(user);
  }

  const update = {};
  if (data.name) update.name = data.name;
  if (data.password) update.password = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.update({ where: { id }, data: update });
  return sanitize(user);
}

export async function listUsers() {
  if (config.demoMode) {
    const store = await getDemoStore();
    return store.users.map(sanitize);
  }
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return users.map(sanitize);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../src/config.js';
import { prisma } from '../src/db/prisma.js';
import {
  createUser,
  findOrCreateClerkUser,
  findUserByEmail,
} from '../src/services/userService.js';

test('Clerk sync rejects email-only merges and requires verified Google ownership', async () => {
  const email = `clerk_link_${randomUUID()}@example.test`;
  const password = `Pass_${randomUUID().slice(0, 8)}`;
  const clerkIdA = `user_${randomUUID().replace(/-/g, '')}`;
  const googleId = `g_${randomUUID().replace(/-/g, '')}`;

  const created = await createUser({
    email,
    password,
    name: 'Existing Member',
    emailVerifiedAt: new Date(),
  });

  await assert.rejects(
    () => findOrCreateClerkUser({
      clerkId: clerkIdA,
      email,
      name: 'Existing Member',
      emailVerified: false,
    }),
    (error) => error.status === 401
  );

  // Email-only Clerk claims must not attach to an existing password row.
  await assert.rejects(
    () => findOrCreateClerkUser({
      clerkId: clerkIdA,
      email,
      name: 'Existing Member',
      emailVerified: true,
      googleVerified: false,
    }),
    (error) => error.status === 409
  );

  const linked = await findOrCreateClerkUser({
    clerkId: clerkIdA,
    email,
    name: 'Existing Member',
    emailVerified: true,
    googleVerified: true,
    googleId,
  });
  assert.equal(linked.id, created.id);
  assert.equal(linked.email, email);
  assert.ok(linked.emailVerifiedAt);

  const row = await findUserByEmail(email);
  assert.equal(row.clerkId, clerkIdA);
  assert.equal(row.googleId, googleId);
  assert.ok(row.emailVerifiedAt);

  const again = await findOrCreateClerkUser({
    clerkId: clerkIdA,
    email,
    name: 'Existing Member',
    emailVerified: true,
    googleVerified: true,
    googleId,
  });
  assert.equal(again.id, created.id);

  const count = await prisma.user.count({ where: { email } });
  assert.equal(count, 1);

  await prisma.user.deleteMany({ where: { email } }).catch(() => {});
});

test('a conflicting Clerk ID cannot replace an existing binding', async () => {
  const email = `clerk_google_${randomUUID()}@example.test`;
  const password = `Pass_${randomUUID().slice(0, 8)}`;
  const googleId = `g_${randomUUID().replace(/-/g, '')}`;
  const clerkIdA = `user_${randomUUID().replace(/-/g, '')}`;
  const clerkIdB = `user_${randomUUID().replace(/-/g, '')}`;

  const created = await createUser({
    email,
    password,
    name: 'Google Member',
    googleId,
    clerkId: clerkIdA,
    emailVerifiedAt: new Date(),
  });

  await assert.rejects(
    () => findOrCreateClerkUser({
      clerkId: clerkIdB,
      email,
      name: 'Google Member',
      emailVerified: true,
      googleVerified: false,
      googleId,
    }),
    (error) => error.status === 409
  );

  await assert.rejects(
    () => findOrCreateClerkUser({
      clerkId: clerkIdB,
      email,
      name: 'Google Member',
      emailVerified: true,
      googleVerified: true,
      googleId: `other_${googleId}`,
    }),
    (error) => error.status === 409
  );

  await assert.rejects(() => findOrCreateClerkUser({
    clerkId: clerkIdB, email, emailVerified: true, googleVerified: true, googleId,
  }), { status: 409 });
  const row = await findUserByEmail(email);
  assert.equal(row.id, created.id);
  assert.equal(row.clerkId, clerkIdA);
  assert.equal(row.googleId, googleId);

  await prisma.user.deleteMany({ where: { email } }).catch(() => {});
});

test('returning Clerk users retain their existing binding', async () => {
  const email = `clerk_gid_${randomUUID()}@example.test`;
  const googleId = `g_${randomUUID().replace(/-/g, '')}`;
  const clerkIdA = `user_${randomUUID().replace(/-/g, '')}`;
  const clerkIdB = `user_${randomUUID().replace(/-/g, '')}`;

  const created = await createUser({
    email,
    password: null,
    name: 'Returning Google',
    googleId,
    clerkId: clerkIdA,
    emailVerifiedAt: new Date(),
  });

  const restored = await findOrCreateClerkUser({
    clerkId: clerkIdA,
    email,
    name: 'Returning Google',
    emailVerified: true,
    googleVerified: true,
    googleId,
  });

  assert.equal(restored.id, created.id);
  const row = await findUserByEmail(email);
  assert.equal(row.clerkId, clerkIdA);
  assert.equal(row.googleId, googleId);

  await prisma.user.deleteMany({ where: { email } }).catch(() => {});
});

test('provider IDs alone do not mark email verified without Google email ownership proof', async () => {
  const email = `no_backfill_${randomUUID()}@example.test`;
  const googleId = `g_${randomUUID().replace(/-/g, '')}`;
  const clerkId = `user_${randomUUID().replace(/-/g, '')}`;

  const created = await createUser({
    email,
    password: `Pass_${randomUUID().slice(0, 8)}`,
    name: 'Unverified',
    googleId,
    clerkId,
  });
  assert.equal(created.emailVerifiedAt, null);

  const returning = await findOrCreateClerkUser({
    clerkId,
    email,
    name: 'Unverified',
    emailVerified: true,
    googleVerified: false,
  });
  assert.equal(returning.id, created.id);
  assert.equal(returning.emailVerifiedAt, null);

  const row = await findUserByEmail(email);
  assert.equal(row.emailVerifiedAt, null);

  await prisma.user.deleteMany({ where: { email } }).catch(() => {});
});

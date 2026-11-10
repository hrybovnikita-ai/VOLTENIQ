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

test('Clerk sync links existing email accounts and rejects unverified clerkId swaps', async () => {
  const email = `clerk_link_${randomUUID()}@example.test`;
  const password = `Pass_${randomUUID().slice(0, 8)}`;
  const clerkIdA = `user_${randomUUID().replace(/-/g, '')}`;
  const clerkIdB = `user_${randomUUID().replace(/-/g, '')}`;

  const created = await createUser({
    email,
    password,
    name: 'Existing Member',
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

  const linked = await findOrCreateClerkUser({
    clerkId: clerkIdA,
    email,
    name: 'Existing Member',
    emailVerified: true,
  });
  assert.equal(linked.id, created.id);
  assert.equal(linked.email, email);

  const row = await findUserByEmail(email);
  assert.equal(row.clerkId, clerkIdA);

  const again = await findOrCreateClerkUser({
    clerkId: clerkIdA,
    email,
    name: 'Existing Member',
    emailVerified: true,
  });
  assert.equal(again.id, created.id);

  await assert.rejects(
    () => findOrCreateClerkUser({
      clerkId: clerkIdB,
      email,
      name: 'Other',
      emailVerified: true,
    }),
    (error) => error.status === 409
  );

  const count = await prisma.user.count({ where: { email } });
  assert.equal(count, 1);
});

test('verified Google ownership may adopt a newer Clerk user id without duplicating the store row', async () => {
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

  const relinked = await findOrCreateClerkUser({
    clerkId: clerkIdB,
    email,
    name: 'Google Member',
    emailVerified: true,
    googleVerified: true,
    googleId,
    avatarUrl: 'https://img.example/avatar.png',
  });

  assert.equal(relinked.id, created.id);
  assert.equal(relinked.email, email);

  const row = await findUserByEmail(email);
  assert.equal(row.clerkId, clerkIdB);
  assert.equal(row.googleId, googleId);
  assert.equal(await prisma.user.count({ where: { email } }), 1);
  assert.equal(await prisma.user.count({ where: { clerkId: clerkIdA } }), 0);
});

test('returning Google users are found by googleId even when Clerk user id changed', async () => {
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
  });

  const restored = await findOrCreateClerkUser({
    clerkId: clerkIdB,
    email,
    name: 'Returning Google',
    emailVerified: true,
    googleVerified: true,
    googleId,
  });

  assert.equal(restored.id, created.id);
  const row = await findUserByEmail(email);
  assert.equal(row.clerkId, clerkIdB);
  assert.equal(row.googleId, googleId);
});

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

test('Clerk sync links existing email accounts and rejects conflicting clerkIds', async () => {
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

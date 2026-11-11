/**
 * Safe Clerk-only → Firebase cutover prep for password accounts.
 *
 * Default: dry-run audit only (no writes).
 * Apply (requires explicit flags): sets emailVerifiedAt and clears clerkId so
 * local password login works and Firebase Google can attach later without
 * creating a duplicate row. Never deletes users, orders, carts, or passwords.
 *
 * Usage:
 *   node scripts/load-neon-env.mjs node scripts/migrate-clerk-only-users.mjs
 *   node scripts/load-neon-env.mjs node scripts/migrate-clerk-only-users.mjs --apply --confirm-example-test-only
 */
import { createHash } from 'node:crypto';
import { prisma } from '../src/db/prisma.js';

const APPLY = process.argv.includes('--apply');
const CONFIRM_EXAMPLE_TEST = process.argv.includes('--confirm-example-test-only');
const ALLOW_ALL_DOMAINS = process.argv.includes('--allow-all-domains');

function emailHash(email) {
  return createHash('sha256').update(String(email).toLowerCase()).digest('hex').slice(0, 12);
}

function passwordKind(password) {
  if (!password) return 'none';
  if (password === 'GOOGLE_ONLY' || String(password).startsWith('GOOGLE_ONLY')) return 'google_only';
  if (String(password).startsWith('$2')) return 'bcrypt';
  return 'other';
}

function isExampleTest(email) {
  return String(email).toLowerCase().endsWith('@example.test');
}

const candidates = await prisma.user.findMany({
  where: {
    clerkId: { not: null },
    googleId: null,
    firebaseUid: null,
  },
  select: {
    id: true,
    email: true,
    name: true,
    clerkId: true,
    emailVerifiedAt: true,
    password: true,
    role: true,
    createdAt: true,
    _count: { select: { orders: true, sessions: true, favorites: true } },
  },
  orderBy: { createdAt: 'asc' },
});

const eligible = candidates.filter((user) => {
  if (passwordKind(user.password) !== 'bcrypt') return false;
  if (!ALLOW_ALL_DOMAINS && !isExampleTest(user.email)) return false;
  return true;
});

const skipped = candidates
  .filter((user) => !eligible.some((e) => e.id === user.id))
  .map((user) => ({
    id: user.id,
    emailHash: emailHash(user.email),
    emailDomain: String(user.email).split('@')[1] || null,
    reason: passwordKind(user.password) !== 'bcrypt'
      ? `password_kind=${passwordKind(user.password)}`
      : 'non_example_test_domain_requires_--allow-all-domains',
  }));

const plan = eligible.map((user) => ({
  id: user.id,
  emailHash: emailHash(user.email),
  emailDomain: String(user.email).split('@')[1] || null,
  clerkIdPrefix: String(user.clerkId).slice(0, 8),
  emailVerifiedAtBefore: user.emailVerifiedAt,
  emailVerifiedAtAfter: user.emailVerifiedAt || 'NOW()',
  clerkIdAfter: null,
  passwordPreserved: true,
  orders: user._count.orders,
  sessions: user._count.sessions,
  favorites: user._count.favorites,
}));

const report = {
  mode: APPLY ? 'apply' : 'dry-run',
  candidateCount: candidates.length,
  eligibleCount: eligible.length,
  skippedCount: skipped.length,
  allowAllDomains: ALLOW_ALL_DOMAINS,
  plan,
  skipped,
};

if (!APPLY) {
  console.log(JSON.stringify({
    ...report,
    nextStep: 'Re-run with --apply --confirm-example-test-only after explicit approval. No Production users were modified.',
  }, null, 2));
  await prisma.$disconnect();
  process.exit(0);
}

if (!CONFIRM_EXAMPLE_TEST && !ALLOW_ALL_DOMAINS) {
  console.error(JSON.stringify({
    error: 'Refusing apply without --confirm-example-test-only (or --allow-all-domains with separate approval).',
    hint: 'Dry-run succeeded; wait for explicit Production user migration approval.',
  }, null, 2));
  await prisma.$disconnect();
  process.exit(2);
}

if (ALLOW_ALL_DOMAINS && !process.argv.includes('--i-approve-all-domain-migration')) {
  console.error(JSON.stringify({
    error: 'Refusing --allow-all-domains apply without --i-approve-all-domain-migration.',
  }, null, 2));
  await prisma.$disconnect();
  process.exit(2);
}

const results = [];
for (const user of eligible) {
  // Optimistic concurrency: require the same identity shape we audited.
  // Prisma rejects `field: null` on unique filters in `update`, so use AND + values.
  const updated = await prisma.user.update({
    where: {
      id: user.id,
      AND: [
        { clerkId: user.clerkId },
        { googleId: user.googleId },
        { firebaseUid: user.firebaseUid },
        { email: user.email },
      ],
    },
    data: {
      emailVerifiedAt: user.emailVerifiedAt || new Date(),
      clerkId: null,
    },
    select: {
      id: true,
      emailVerifiedAt: true,
      clerkId: true,
      googleId: true,
      firebaseUid: true,
      password: true,
      email: true,
    },
  });
  if (!String(updated.email).toLowerCase().endsWith('@example.test')) {
    throw new Error(`Refusing unexpected domain for ${updated.id}`);
  }
  results.push({
    id: updated.id,
    emailHash: emailHash(user.email),
    emailVerifiedAt: updated.emailVerifiedAt,
    clerkId: updated.clerkId,
    googleId: updated.googleId,
    firebaseUid: updated.firebaseUid,
    passwordPreserved: passwordKind(updated.password) === 'bcrypt',
  });
}

console.log(JSON.stringify({
  ...report,
  applied: results.length,
  results,
}, null, 2));

await prisma.$disconnect();

// Runs the real app with NODE_ENV=production (Secure + __Host- cookies) against
// the local test database. Prints a JSON report for test/logout.test.js.
import { randomUUID } from 'node:crypto';
import express from 'express';

const { default: app } = await import('../../src/app.js');
const { prisma } = await import('../../src/db/prisma.js');
const { startSession, SESSION_COOKIE_NAME } = await import('../../src/services/sessionService.js');

const user = await prisma.user.create({
  data: {
    name: 'Prod Logout',
    email: `${randomUUID()}@example.test`,
    password: 'x',
    emailVerifiedAt: new Date(),
  },
});

const harness = express();
harness.post('/__test/start', async (req, res) => {
  await startSession(req, res, user.id);
  res.json({ ok: true });
});
harness.use(app);

const server = await new Promise((resolve) => {
  const instance = harness.listen(0, '127.0.0.1', () => resolve(instance));
});
const base = `http://127.0.0.1:${server.address().port}`;
const call = async (path, { method = 'GET', cookie } = {}) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  });
  return {
    status: response.status,
    setCookie: response.headers.getSetCookie(),
    body: await response.json().catch(() => null),
  };
};

try {
  const started = await call('/__test/start', { method: 'POST' });
  const cookie = started.setCookie.map((v) => v.split(';')[0]).join('; ');
  const before = await call('/api/auth/session', { cookie });
  const out = await call('/api/auth/logout', { method: 'POST', cookie });
  const after = await call('/api/auth/session', { cookie });
  const me = await call('/api/auth/me', { cookie });
  console.log(JSON.stringify({
    name: SESSION_COOKIE_NAME,
    set: started.setCookie,
    beforeUser: before.body?.data?.user?.id === user.id,
    logoutStatus: out.status,
    cleared: out.setCookie,
    afterUser: after.body?.data?.user ?? null,
    meStatus: me.status,
    remainingSessions: await prisma.session.count({ where: { userId: user.id } }),
    userStillExists: Boolean(await prisma.user.findUnique({ where: { id: user.id } })),
  }));
} finally {
  await new Promise((resolve) => server.close(resolve));
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  await prisma.$disconnect();
}

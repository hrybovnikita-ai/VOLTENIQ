import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { SESSION_COOKIE_NAME } from '../src/services/sessionService.js';

function cookieHeader(setCookie = []) {
  return setCookie
    .map((value) => String(value).split(';')[0])
    .filter(Boolean)
    .join('; ');
}

async function withServer(run) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const { port } = server.address();

  try {
    await run({
      async request(path, { method = 'GET', body, cookie } = {}) {
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Origin: 'http://localhost:5173',
            ...(cookie ? { Cookie: cookie } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const setCookie = typeof response.headers.getSetCookie === 'function'
          ? response.headers.getSetCookie()
          : [];
        const payload = await response.json().catch(() => null);
        return { response, payload, setCookie, cookie: cookieHeader(setCookie) };
      },
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('password change requires current password and revokes other sessions', async () => {
  const email = `sec_${randomUUID()}@example.test`;
  const password = `OldPass_${randomUUID().slice(0, 8)}`;
  const nextPassword = `NewPass_${randomUUID().slice(0, 8)}`;

  await withServer(async ({ request }) => {
    const registered = await request('/api/auth/register', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(registered.response.status, 201);
    const cookieA = registered.cookie;

    const secondLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(secondLogin.response.status, 200);
    const cookieB = secondLogin.cookie;
    assert.ok(cookieB);

    const denied = await request('/api/auth/me', {
      method: 'PUT',
      cookie: cookieB,
      body: { password: nextPassword },
    });
    assert.equal(denied.response.status, 400);

    const wrong = await request('/api/auth/me', {
      method: 'PUT',
      cookie: cookieB,
      body: { password: nextPassword, currentPassword: 'definitely-wrong' },
    });
    assert.equal(wrong.response.status, 401);

    const changed = await request('/api/auth/me', {
      method: 'PUT',
      cookie: cookieB,
      body: { password: nextPassword, currentPassword: password },
    });
    assert.equal(changed.response.status, 200);
    assert.ok(sessionCookie(changed.setCookie));

    const stale = await request('/api/auth/me', { cookie: cookieA });
    assert.equal(stale.response.status, 401);

    const fresh = await request('/api/auth/me', { cookie: changed.cookie });
    assert.equal(fresh.response.status, 200);
    assert.equal(fresh.payload.data.user.email, email);
  });

  await prisma.user.deleteMany({ where: { email } }).catch(() => {});
});

function sessionCookie(setCookie = []) {
  return setCookie.find((value) => String(value).startsWith(`${SESSION_COOKIE_NAME}=`));
}

test('firebase bridge is disabled when Clerk is enabled', async () => {
  await withServer(async ({ request }) => {
    const providers = await request('/api/auth/providers');
    assert.equal(providers.payload.data.clerk, true);
    assert.equal(providers.payload.data.firebase, false);

    const firebase = await request('/api/auth/firebase', {
      method: 'POST',
      body: { idToken: 'not-a-real-token' },
    });
    assert.equal(firebase.response.status, 410);
  });
});

test('register rejects short passwords and duplicate emails', async () => {
  const email = `dupsec_${randomUUID()}@example.test`;
  const password = `Strong_${randomUUID().slice(0, 8)}`;

  await withServer(async ({ request }) => {
    const short = await request('/api/auth/register', {
      method: 'POST',
      body: { email, password: 'short' },
    });
    assert.equal(short.response.status, 400);

    const first = await request('/api/auth/register', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(first.response.status, 201);

    const dup = await request('/api/auth/register', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(dup.response.status, 409);
    assert.match(String(dup.payload.message || ''), /already registered/i);
  });

  await prisma.user.deleteMany({ where: { email } }).catch(() => {});
});

test('admin endpoints reject unauthenticated and non-admin callers', async () => {
  const email = `usersec_${randomUUID()}@example.test`;
  const password = `UserPass_${randomUUID().slice(0, 8)}`;

  await withServer(async ({ request }) => {
    const anon = await request('/api/admin/users');
    assert.equal(anon.response.status, 401);

    const registered = await request('/api/auth/register', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(registered.response.status, 201);

    const forbidden = await request('/api/admin/users', { cookie: registered.cookie });
    assert.equal(forbidden.response.status, 403);
  });

  await prisma.user.deleteMany({ where: { email } }).catch(() => {});
});

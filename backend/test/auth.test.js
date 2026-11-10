import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { SESSION_COOKIE_NAME, SESSION_LIFETIME_MS } from '../src/services/sessionService.js';

function cookieHeader(setCookie = []) {
  return setCookie
    .map((value) => String(value).split(';')[0])
    .filter(Boolean)
    .join('; ');
}

function sessionCookie(setCookie = []) {
  return setCookie.find((value) => String(value).startsWith(`${SESSION_COOKIE_NAME}=`));
}

async function withServer(run) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  try {
    await run({
      origin,
      async request(path, { method = 'GET', body, cookie } = {}) {
        const response = await fetch(`${origin}${path}`, {
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

test('register, login, me, logout, and invalid password use HttpOnly cookie sessions', async () => {
  const email = `auth_${randomUUID()}@example.test`;
  const password = `Pass_${randomUUID().slice(0, 8)}`;

  await withServer(async ({ request }) => {
    const registered = await request('/api/auth/register', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(registered.response.status, 201);
    assert.equal(registered.payload.success, true);
    assert.equal(registered.payload.data.user.email, email);
    assert.equal(registered.payload.data.token, undefined);
    assert.ok(!('password' in registered.payload.data.user));

    const registerCookie = sessionCookie(registered.setCookie);
    assert.ok(registerCookie, 'registration must set a session cookie');
    assert.match(registerCookie, /HttpOnly/i);
    assert.match(registerCookie, /SameSite=Lax/i);
    assert.doesNotMatch(registerCookie, /Secure/i);

    const meAfterRegister = await request('/api/auth/me', { cookie: registered.cookie });
    assert.equal(meAfterRegister.response.status, 200);
    assert.equal(meAfterRegister.payload.data.user.id, registered.payload.data.user.id);

    const badLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password: `${password}-wrong` },
    });
    assert.equal(badLogin.response.status, 401);
    assert.equal(badLogin.payload.success, false);
    assert.equal(sessionCookie(badLogin.setCookie), undefined);

    const login = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.payload.data.user.email, email);
    assert.equal(login.payload.data.token, undefined);
    assert.ok(sessionCookie(login.setCookie));

    const me = await request('/api/auth/me', { cookie: login.cookie });
    assert.equal(me.response.status, 200);
    assert.equal(me.payload.data.user.email, email);

    const sessions = await prisma.session.findMany({
      where: { userId: login.payload.data.user.id },
    });
    assert.ok(sessions.length >= 1);
    const remaining = sessions[0].expiresAt.getTime() - Date.now();
    assert.ok(remaining > SESSION_LIFETIME_MS - 60_000);
    assert.ok(remaining <= SESSION_LIFETIME_MS);

    const logout = await request('/api/auth/logout', {
      method: 'POST',
      cookie: login.cookie,
    });
    assert.equal(logout.response.status, 200);
    assert.ok(sessionCookie(logout.setCookie) || logout.setCookie.some((value) => String(value).includes(`${SESSION_COOKIE_NAME}=`)));

    const meAfterLogout = await request('/api/auth/me', { cookie: login.cookie });
    assert.equal(meAfterLogout.response.status, 401);

    const unknown = await request('/api/auth/login', {
      method: 'POST',
      body: { email: `missing_${randomUUID()}@example.test`, password },
    });
    assert.equal(unknown.response.status, 401);
  });
});

test('duplicate registration is rejected and failed login never creates an account', async () => {
  const email = `dup_${randomUUID()}@example.test`;
  const password = `Pass_${randomUUID().slice(0, 8)}`;

  await withServer(async ({ request }) => {
    const first = await request('/api/auth/register', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(first.response.status, 201);

    const duplicate = await request('/api/auth/register', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(duplicate.response.status, 409);

    const missingEmail = `ghost_${randomUUID()}@example.test`;
    const before = await prisma.user.count({ where: { email: missingEmail } });
    const failed = await request('/api/auth/login', {
      method: 'POST',
      body: { email: missingEmail, password },
    });
    assert.equal(failed.response.status, 401);
    const after = await prisma.user.count({ where: { email: missingEmail } });
    assert.equal(after, before);
  });
});

test('email-link recovery changes the database password and revokes prior sessions', async () => {
  const email = `recovery_${randomUUID()}@example.test`;
  await withServer(async ({ request }) => {
    const oldPassword = randomUUID();
    const newPassword = randomUUID();
    const original = await request('/api/auth/register', { method: 'POST', body: { email, password: oldPassword } });
    const fetchOriginal = globalThis.fetch;
    let consumed = false;
    globalThis.fetch = async (url, options) => {
      if (!(url instanceof URL) || url.hostname !== 'identitytoolkit.googleapis.com') return fetchOriginal(url, options);
      const input = JSON.parse(options.body);
      if (input.oobCode !== 'test-link' || input.email !== email || consumed) return Response.json({}, { status: 400 });
      consumed = true;
      return Response.json({ email });
    };
    const reset = code => request('/api/auth/reset-password', { method: 'POST', body: { email, password: newPassword, code } });
    try {
      assert.equal((await reset('wrong')).response.status, 400);
      assert.equal((await reset('test-link')).response.status, 200);
      assert.equal((await reset('test-link')).response.status, 400);
      assert.equal((await request('/api/auth/me', { cookie: original.cookie })).response.status, 401);
      for (const [password, status] of [[oldPassword, 401], [newPassword, 200]]) {
        assert.equal((await request('/api/auth/login', { method: 'POST', body: { email, password } })).response.status, status);
      }
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });
});

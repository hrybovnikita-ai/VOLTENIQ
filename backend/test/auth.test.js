import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.AUTH_PROVIDER = 'firebase';
process.env.FIREBASE_PROJECT_ID = 'volteniq-test';
process.env.AUTH_TEST_RETURN_TOKEN = '1';

const { default: app } = await import('../src/app.js');
const { prisma } = await import('../src/db/prisma.js');
const { SESSION_COOKIE_NAME, SESSION_LIFETIME_MS } = await import('../src/services/sessionService.js');

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

async function registerAndVerify(request, email, password) {
  const registered = await request('/api/auth/register', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(registered.response.status, 201);
  assert.equal(registered.payload.data.needsVerification, true);
  assert.equal(registered.payload.data.user, undefined);
  assert.ok(!sessionCookie(registered.setCookie));
  const token = registered.payload.data.token;
  assert.ok(token);

  const before = await prisma.user.findUnique({ where: { email } });
  assert.equal(before.emailVerifiedAt, null);

  const unverifiedLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(unverifiedLogin.response.status, 401);
  assert.equal(unverifiedLogin.payload.code, 'email_unverified');

  const verified = await request('/api/auth/verify-email', {
    method: 'POST',
    body: { email, token },
  });
  assert.equal(verified.response.status, 200);
  assert.ok(sessionCookie(verified.setCookie));
  assert.ok(verified.payload.data.user.emailVerifiedAt);
  assert.equal(verified.payload.data.user.emailVerified, true);

  const after = await prisma.user.findUnique({ where: { email } });
  assert.ok(after.emailVerifiedAt instanceof Date);
  assert.equal(after.id, before.id);
  return verified;
}

test('verification link sets emailVerifiedAt in PostgreSQL and preserves the same user row', async () => {
  const email = `verify_db_${randomUUID()}@example.test`;
  const password = `Pass_${randomUUID().slice(0, 8)}`;
  await withServer(async ({ request }) => {
    const verified = await registerAndVerify(request, email, password);
    const row = await prisma.user.findUnique({ where: { email } });
    assert.equal(row.id, verified.payload.data.user.id);
    assert.ok(row.emailVerifiedAt);
    assert.equal(row.email, email);
    // Same account can log in after verification; row is not duplicated.
    const login = await request('/api/auth/login', { method: 'POST', body: { email, password } });
    assert.equal(login.response.status, 200);
    assert.equal(login.payload.data.user.id, row.id);
    assert.equal(await prisma.user.count({ where: { email } }), 1);
  });
  await prisma.user.deleteMany({ where: { email } }).catch(() => {});
});

test('register requires verification before password login and sets HttpOnly sessions', async () => {
  const email = `auth_${randomUUID()}@example.test`;
  const password = `Pass_${randomUUID().slice(0, 8)}`;

  await withServer(async ({ request }) => {
    const verified = await registerAndVerify(request, email, password);
    assert.equal(verified.payload.data.user.email, email);
    assert.equal(verified.payload.data.token, undefined);

    const registerCookie = sessionCookie(verified.setCookie);
    assert.match(registerCookie, /HttpOnly/i);
    assert.match(registerCookie, /SameSite=Lax/i);
    assert.doesNotMatch(registerCookie, /Secure/i);

    const meAfterVerify = await request('/api/auth/me', { cookie: verified.cookie });
    assert.equal(meAfterVerify.response.status, 200);
    assert.equal(meAfterVerify.payload.data.user.id, verified.payload.data.user.id);

    await request('/api/auth/logout', { method: 'POST', cookie: verified.cookie });

    const badLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password: `${password}-wrong` },
    });
    assert.equal(badLogin.response.status, 401);
    assert.equal(sessionCookie(badLogin.setCookie), undefined);

    const login = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.payload.data.user.email, email);
    assert.ok(sessionCookie(login.setCookie));

    const me = await request('/api/auth/me', { cookie: login.cookie });
    assert.equal(me.response.status, 200);

    const sessions = await prisma.session.findMany({
      where: { userId: login.payload.data.user.id },
    });
    assert.ok(sessions.length >= 1);
    const remaining = sessions[0].expiresAt.getTime() - Date.now();
    assert.ok(remaining > SESSION_LIFETIME_MS - 60_000);
    assert.ok(remaining <= SESSION_LIFETIME_MS);

    const listed = await request('/api/auth/sessions', { cookie: login.cookie });
    assert.equal(listed.response.status, 200);
    assert.ok(listed.payload.data.sessions.some((s) => s.current));

    const logout = await request('/api/auth/logout', {
      method: 'POST',
      cookie: login.cookie,
    });
    assert.equal(logout.response.status, 200);
    const cleared = logout.setCookie.filter((value) => /volteniq_session=/i.test(String(value)));
    assert.ok(cleared.length >= 1, 'logout must clear the session cookie');
    assert.ok(
      cleared.every((value) => /Max-Age=0|Expires=/i.test(String(value))),
      'logout Set-Cookie must expire the session cookie for Safari/Chrome'
    );
    assert.ok(
      cleared.some((value) => String(value).startsWith(`${SESSION_COOKIE_NAME}=`)),
      'logout must clear the active session cookie name'
    );

    const remainingSessions = await prisma.session.count({
      where: { userId: login.payload.data.user.id },
    });
    assert.equal(remainingSessions, 0);

    const meAfterLogout = await request('/api/auth/me', { cookie: login.cookie });
    assert.equal(meAfterLogout.response.status, 401);
  });

  await prisma.user.deleteMany({ where: { email } }).catch(() => {});
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

  await prisma.user.deleteMany({ where: { email } }).catch(() => {});
});

test('first-party password recovery changes the password and revokes prior sessions', async () => {
  const email = `recovery_${randomUUID()}@example.test`;
  const oldPassword = `Old_${randomUUID().slice(0, 8)}`;
  const newPassword = `New_${randomUUID().slice(0, 8)}`;

  await withServer(async ({ request }) => {
    const verified = await registerAndVerify(request, email, oldPassword);
    const cookie = verified.cookie;

    const forgot = await request('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
    assert.equal(forgot.response.status, 200);
    const token = forgot.payload.data?.token;
    // Token is returned only via AUTH_TEST_RETURN_TOKEN on sendPasswordReset — route does not expose it.
    // Read the latest unused reset token from the DB hash by requesting through the test sink path:
    // sendPasswordReset returns token but requestPasswordReset may pass it through.
    assert.equal(token, undefined);

    // Issue reset via service-level response: call forgot again after cooldown with direct token from DB helper.
    const { sendPasswordReset } = await import('../src/services/authTokenService.js');
    const user = await prisma.user.findUnique({ where: { email } });
    // Bypass cooldown by clearing recent tokens' createdAt
    await prisma.authToken.updateMany({
      where: { userId: user.id, type: 'PASSWORD_RESET' },
      data: { createdAt: new Date(Date.now() - 120_000) },
    });
    const sent = await sendPasswordReset(user);
    assert.ok(sent.token);

    const wrong = await request('/api/auth/reset-password', {
      method: 'POST',
      body: { email, password: newPassword, token: 'a'.repeat(64) },
    });
    assert.equal(wrong.response.status, 400);

    const reset = await request('/api/auth/reset-password', {
      method: 'POST',
      body: { email, password: newPassword, token: sent.token },
    });
    assert.equal(reset.response.status, 200);

    const reuse = await request('/api/auth/reset-password', {
      method: 'POST',
      body: { email, password: newPassword, token: sent.token },
    });
    assert.equal(reuse.response.status, 400);

    assert.equal((await request('/api/auth/me', { cookie })).response.status, 401);

    for (const [password, status] of [[oldPassword, 401], [newPassword, 200]]) {
      assert.equal(
        (await request('/api/auth/login', { method: 'POST', body: { email, password } })).response.status,
        status
      );
    }
  });

  await prisma.user.deleteMany({ where: { email } }).catch(() => {});
});

test('Firebase verifies signed Google claims and restores the same SQL user via its cookie', async (t) => {
  const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const key = { ...await exportJWK(publicKey), kid: 'fixture', alg: 'RS256' };
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', (url, options) =>
    String(url).startsWith('https://www.googleapis.com/service_accounts/v1/jwk/') ?
      Promise.resolve(Response.json({ keys: [key] })) : originalFetch(url, options));
  async function token(email, uid, googleId, verified = true) {
    return new SignJWT({ email, email_verified: verified, firebase: {
      sign_in_provider: 'google.com', identities: { 'google.com': [googleId] },
    } }).setProtectedHeader({ alg: 'RS256', kid: 'fixture' }).setIssuedAt().setExpirationTime('5m')
      .setSubject(uid).setAudience('volteniq-test').setIssuer('https://securetoken.google.com/volteniq-test').sign(privateKey);
  }
  await withServer(async ({ request }) => {
    const email = randomUUID() + '@example.test';
    const google = randomUUID();
    const uid = randomUUID();
    async function exchange(idToken) {
      return request('/api/auth/firebase', { method: 'POST', body: { idToken } });
    }
    assert.equal((await exchange(await token(email, uid, google, false))).response.status, 401);
    const first = await exchange(await token(email, uid, google));
    assert.equal(first.response.status, 200);
    assert.match(sessionCookie(first.setCookie), /HttpOnly/i);
    const id = first.payload.data.user.id;
    assert.equal((await request('/api/auth/session', { cookie: first.cookie })).payload.data.user.id, id);
    assert.equal((await exchange(await token(email, uid, google))).payload.data.user.id, id);
    assert.equal((await exchange(await token(email, randomUUID(), google))).response.status, 409);
    assert.equal((await prisma.user.findUnique({ where: { id } })).googleId, google);
    const existingEmail = randomUUID() + '@example.test';
    const existing = await registerAndVerify(request, existingEmail, randomUUID());
    const linked = await exchange(await token(existingEmail, randomUUID(), randomUUID()));
    assert.equal(linked.payload.data.user.id, existing.payload.data.user.id);

    const squatEmail = randomUUID() + '@example.test';
    const squatPassword = `Pass_${randomUUID().slice(0, 8)}`;
    const squatReg = await request('/api/auth/register', {
      method: 'POST',
      body: { email: squatEmail, password: squatPassword },
    });
    assert.equal(squatReg.response.status, 201);
    const reclaimed = await exchange(await token(squatEmail, randomUUID(), randomUUID()));
    assert.equal(reclaimed.response.status, 200);
    assert.equal(reclaimed.payload.data.user.email, squatEmail);
    assert.ok(reclaimed.payload.data.user.emailVerifiedAt);
    assert.equal(
      (await request('/api/auth/login', {
        method: 'POST',
        body: { email: squatEmail, password: squatPassword },
      })).response.status,
      401
    );

    await request('/api/auth/logout', { method: 'POST', cookie: first.cookie });
    assert.equal((await request('/api/auth/session', { cookie: first.cookie })).payload.data.user, null);
  });
});

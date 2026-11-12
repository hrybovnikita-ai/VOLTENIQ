import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.AUTH_PROVIDER = 'firebase';
process.env.FIREBASE_PROJECT_ID = 'volteniq-test';
process.env.AUTH_TEST_RETURN_TOKEN = '1';

const { default: app } = await import('../src/app.js');
const { prisma } = await import('../src/db/prisma.js');
const { SESSION_COOKIE_NAME } = await import('../src/services/sessionService.js');
const { createUser } = await import('../src/services/userService.js');
const { createFirebaseAuthProxyMiddleware, isFirebaseProxyPath } = await import('../src/middleware/firebaseAuthProxy.js');

function cookieHeader(setCookie = []) {
  return setCookie.map((value) => String(value).split(';')[0]).filter(Boolean).join('; ');
}

function sessionCookie(setCookie = []) {
  return setCookie.find((value) => String(value).startsWith(`${SESSION_COOKIE_NAME}=`));
}

async function withServer(run, { appInstance = app } = {}) {
  const server = await new Promise((resolve) => {
    const instance = appInstance.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    await run({
      base,
      async request(path, { method = 'GET', body, cookie, origin = 'http://localhost:5173', headers = {} } = {}) {
        const response = await fetch(`${base}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(origin ? { Origin: origin } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
            ...headers,
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
  const registered = await request('/api/auth/register', { method: 'POST', body: { email, password } });
  assert.equal(registered.response.status, 201);
  const verified = await request('/api/auth/verify-email', {
    method: 'POST',
    body: { email, token: registered.payload.data.token },
  });
  assert.equal(verified.response.status, 200);
  return verified;
}

// One signing key for the whole file: jose caches the JWKS across tests.
const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
const { privateKey, publicKey } = await generateKeyPair('RS256');
const key = { ...await exportJWK(publicKey), kid: 'flows', alg: 'RS256' };

async function firebaseTokenFactory(t) {
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', (url, options) => (
    String(url).startsWith('https://www.googleapis.com/service_accounts/v1/jwk/')
      ? Promise.resolve(Response.json({ keys: [key] }))
      : originalFetch(url, options)
  ));
  return (email, uid, googleId) => new SignJWT({
    email,
    email_verified: true,
    firebase: { sign_in_provider: 'google.com', identities: { 'google.com': [googleId] } },
  }).setProtectedHeader({ alg: 'RS256', kid: 'flows' }).setIssuedAt().setExpirationTime('5m')
    .setSubject(uid).setAudience('volteniq-test').setIssuer('https://securetoken.google.com/volteniq-test')
    .sign(privateKey);
}

const countByEmail = (email) => prisma.user.count({ where: { email: { equals: email, mode: 'insensitive' } } });

test('password account and Google sign-in share one Neon row and both keep working', async (t) => {
  const token = await firebaseTokenFactory(t);
  await withServer(async ({ request }) => {
    const email = `${randomUUID()}@example.test`;
    const password = `Pass_${randomUUID().slice(0, 10)}`;
    const verified = await registerAndVerify(request, email, password);
    const id = verified.payload.data.user.id;

    // Google returns the address with different casing: still the same row.
    const google = await request('/api/auth/firebase', {
      method: 'POST',
      body: { idToken: await token(email.toUpperCase(), randomUUID(), randomUUID()) },
    });
    assert.equal(google.response.status, 200);
    assert.equal(google.payload.data.user.id, id);
    assert.equal(google.payload.data.user.hasGoogle, true);

    const login = await request('/api/auth/login', { method: 'POST', body: { email, password } });
    assert.equal(login.response.status, 200, 'password sign-in must survive Google linking');
    assert.equal(login.payload.data.user.id, id);
    assert.equal(await countByEmail(email), 1);
  });
});

test('Google-first account blocks a duplicate password sign-up for the same email', async (t) => {
  const token = await firebaseTokenFactory(t);
  await withServer(async ({ request }) => {
    const email = `${randomUUID()}@example.test`;
    const google = await request('/api/auth/firebase', {
      method: 'POST',
      body: { idToken: await token(email, randomUUID(), randomUUID()) },
    });
    assert.equal(google.response.status, 200);
    const signup = await request('/api/auth/register', {
      method: 'POST',
      body: { email, password: `Pass_${randomUUID().slice(0, 10)}` },
    });
    assert.equal(signup.response.status, 409);
    assert.equal(await countByEmail(email), 1);
    const login = await request('/api/auth/login', { method: 'POST', body: { email, password: 'whatever-123' } });
    assert.equal(login.response.status, 401, 'Google-only rows never accept a password');
  });
});

test('verified Clerk-only rows link to Google; unverified ones are refused', async (t) => {
  const token = await firebaseTokenFactory(t);
  await withServer(async ({ request }) => {
    const verifiedEmail = `${randomUUID()}@example.test`;
    const verifiedRow = await createUser({
      name: 'Clerk Shopper',
      email: verifiedEmail,
      password: null,
      clerkId: `user_${randomUUID()}`,
      emailVerifiedAt: new Date(),
    });
    const linked = await request('/api/auth/firebase', {
      method: 'POST',
      body: { idToken: await token(verifiedEmail, randomUUID(), randomUUID()) },
    });
    assert.equal(linked.response.status, 200);
    assert.equal(linked.payload.data.user.id, verifiedRow.id);
    assert.equal(await countByEmail(verifiedEmail), 1);

    const unverifiedEmail = `${randomUUID()}@example.test`;
    await createUser({
      name: 'Unverified Clerk',
      email: unverifiedEmail,
      password: null,
      clerkId: `user_${randomUUID()}`,
    });
    const refused = await request('/api/auth/firebase', {
      method: 'POST',
      body: { idToken: await token(unverifiedEmail, randomUUID(), randomUUID()) },
    });
    assert.equal(refused.response.status, 409);
    assert.equal(await countByEmail(unverifiedEmail), 1);
  });
});

test('sign-out deletes the server session, expires the cookie, and the old cookie is dead', async () => {
  await withServer(async ({ request }) => {
    const email = `${randomUUID()}@example.test`;
    const verified = await registerAndVerify(request, email, `Pass_${randomUUID().slice(0, 10)}`);
    const cookie = verified.cookie;
    const set = sessionCookie(verified.setCookie);
    assert.match(set, /HttpOnly/i);
    assert.match(set, /SameSite=Lax/i);
    assert.match(set, /Path=\//i);
    assert.doesNotMatch(set, /Domain=/i, 'host-only cookie');
    const userId = verified.payload.data.user.id;
    assert.equal(await prisma.session.count({ where: { userId } }), 1);

    const out = await request('/api/auth/logout', { method: 'POST', cookie });
    assert.equal(out.response.status, 200);
    assert.equal(out.response.headers.get('cache-control'), 'no-store');
    const cleared = out.setCookie.filter((value) => /volteniq_session=;/.test(value));
    assert.ok(cleared.length >= 1);
    assert.ok(cleared.every((value) => /Expires=Thu, 01 Jan 1970/i.test(value)));
    assert.equal(await prisma.session.count({ where: { userId } }), 0);

    const after = await request('/api/auth/session', { cookie });
    assert.equal(after.payload.data.user, null);
    const me = await request('/api/auth/me', { cookie });
    assert.equal(me.response.status, 401);
  });
});

test('CORS allows same-origin POSTs from any alias of this host but rejects other sites', async () => {
  await withServer(async ({ base, request }) => {
    const host = new URL(base).host;
    // Browsers send Origin on same-origin POSTs. A custom domain or alias that
    // is not in CORS_ORIGIN must still be able to sign in / out.
    const same = await request('/api/auth/logout', { method: 'POST', origin: base });
    assert.equal(same.response.status, 200);
    assert.equal(same.response.headers.get('access-control-allow-origin'), base);
    assert.equal(same.response.headers.get('access-control-allow-credentials'), 'true');

    const proxied = await request('/api/auth/logout', {
      method: 'POST',
      origin: 'https://shop.example',
      headers: { 'X-Forwarded-Host': 'shop.example' },
    });
    assert.equal(proxied.response.status, 200);

    const evil = await request('/api/auth/logout', { method: 'POST', origin: 'https://evil.example' });
    assert.equal(evil.response.status, 403);
    assert.equal(evil.response.headers.get('access-control-allow-origin'), null);

    const noOrigin = await request('/api/auth/session', { origin: null });
    assert.equal(noOrigin.response.status, 200);
    assert.ok(host);
  });
});

test('Firebase auth helper proxy forwards GETs to <project>.firebaseapp.com only', async () => {
  const calls = [];
  const express = (await import('express')).default;
  const proxyApp = express();
  proxyApp.use(createFirebaseAuthProxyMiddleware({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response('<html>handler</html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8', 'set-cookie': 'upstream=1', 'cache-control': 'no-cache' },
      });
    },
  }));
  proxyApp.use((_req, res) => res.status(404).send('next'));

  await withServer(async ({ base }) => {
    const ok = await fetch(`${base}/__/auth/handler?apiKey=k&authType=signInViaRedirect`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=secret` },
    });
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), '<html>handler</html>');
    assert.match(ok.headers.get('content-type'), /text\/html/);
    assert.equal(ok.headers.get('set-cookie'), null, 'upstream cookies are not relayed');
    assert.equal(calls[0].url, 'https://volteniq-test.firebaseapp.com/__/auth/handler?apiKey=k&authType=signInViaRedirect');
    assert.equal(calls[0].options.headers.cookie, undefined, 'store cookies never leave the origin');

    const init = await fetch(`${base}/__/firebase/init.json`);
    assert.equal(init.status, 200);
    assert.equal(calls[1].url, 'https://volteniq-test.firebaseapp.com/__/firebase/init.json');

    const post = await fetch(`${base}/__/auth/handler`, { method: 'POST' });
    assert.equal(post.status, 405);

    const other = await fetch(`${base}/__/other`);
    assert.equal(other.status, 404);
    assert.equal(calls.length, 2);
  }, { appInstance: proxyApp });

  assert.equal(isFirebaseProxyPath('/__/auth/../../etc'), false);
  assert.equal(isFirebaseProxyPath('/__/auth/iframe'), true);
});

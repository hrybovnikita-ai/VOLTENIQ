import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

process.env.AUTH_PROVIDER = 'firebase';
process.env.FIREBASE_PROJECT_ID = 'volteniq-test';
process.env.AUTH_TEST_RETURN_TOKEN = '1';

const { default: app } = await import('../src/app.js');
const { prisma } = await import('../src/db/prisma.js');
const { SESSION_COOKIE_NAME } = await import('../src/services/sessionService.js');

const run = promisify(execFile);

function attrs(setCookie) {
  // "name=value; Path=/; HttpOnly" -> { path: '/', httponly: true, ... } minus expiry fields
  const [, ...parts] = String(setCookie).split(';').map((part) => part.trim()).filter(Boolean);
  const out = {};
  for (const part of parts) {
    const [key, ...rest] = part.split('=');
    const name = key.toLowerCase();
    if (name === 'expires' || name === 'max-age') continue;
    out[name] = rest.length ? rest.join('=').toLowerCase() : true;
  }
  return out;
}

function cookieHeader(setCookie = []) {
  return setCookie.map((value) => String(value).split(';')[0]).filter(Boolean).join('; ');
}

const named = (list, name) => list.find((value) => String(value).startsWith(`${name}=`));

async function withServer(fn) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(async (path, { method = 'GET', body, cookie, origin = 'http://localhost:5173' } = {}) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(origin ? { Origin: origin } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const setCookie = response.headers.getSetCookie();
      return { response, payload: await response.json().catch(() => null), setCookie, cookie: cookieHeader(setCookie) };
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function newVerifiedAccount(request) {
  const email = `${randomUUID()}@example.test`;
  const password = `Pass_${randomUUID().slice(0, 10)}`;
  const registered = await request('/api/auth/register', { method: 'POST', body: { email, password } });
  assert.equal(registered.response.status, 201);
  const verified = await request('/api/auth/verify-email', {
    method: 'POST',
    body: { email, token: registered.payload.data.token },
  });
  assert.equal(verified.response.status, 200);
  return { email, password, userId: verified.payload.data.user.id, cookie: verified.cookie };
}

test('sign in -> refresh -> sign out -> old cookie rejected -> sign in again works', async () => {
  await withServer(async (request) => {
    const account = await newVerifiedAccount(request);
    // Drop the verification session so we exercise a plain password sign-in.
    await request('/api/auth/logout', { method: 'POST', cookie: account.cookie });

    const first = await request('/api/auth/login', {
      method: 'POST',
      body: { email: account.email, password: account.password },
    });
    assert.equal(first.response.status, 200);
    const firstCookie = first.cookie;

    // "Refresh": the bootstrap call restores the same user from the cookie.
    const refreshed = await request('/api/auth/session', { cookie: firstCookie });
    assert.equal(refreshed.payload.data.user.id, account.userId);

    const out = await request('/api/auth/logout', { method: 'POST', cookie: firstCookie });
    assert.equal(out.response.status, 200);
    assert.equal(out.payload.success, true);

    // Refresh after sign-out must not restore the user.
    for (const path of ['/api/auth/session']) {
      const again = await request(path, { cookie: firstCookie });
      assert.equal(again.payload.data.user, null);
    }
    for (const path of ['/api/auth/me', '/api/auth/sessions', '/api/orders']) {
      const denied = await request(path, { cookie: firstCookie });
      assert.equal(denied.response.status, 401, `${path} must reject the revoked cookie`);
    }

    const second = await request('/api/auth/login', {
      method: 'POST',
      body: { email: account.email, password: account.password },
    });
    assert.equal(second.response.status, 200);
    assert.notEqual(second.cookie, firstCookie, 'a fresh session token is issued');
    const me = await request('/api/auth/me', { cookie: second.cookie });
    assert.equal(me.response.status, 200);
    assert.equal(me.payload.data.user.id, account.userId);

    const stale = await request('/api/auth/me', { cookie: firstCookie });
    assert.equal(stale.response.status, 401, 'the old cookie stays dead after signing in again');

    // The account itself is untouched by sign-out.
    const row = await prisma.user.findUnique({ where: { id: account.userId } });
    assert.equal(row.email, account.email);
  });
});

test('logout clears the cookie with the same attributes it was set with', async () => {
  await withServer(async (request) => {
    const account = await newVerifiedAccount(request);
    const login = await request('/api/auth/login', {
      method: 'POST',
      body: { email: account.email, password: account.password },
    });
    const set = named(login.setCookie, SESSION_COOKIE_NAME);
    assert.ok(set);

    const out = await request('/api/auth/logout', { method: 'POST', cookie: login.cookie });
    const cleared = named(out.setCookie, SESSION_COOKIE_NAME);
    assert.ok(cleared, 'active cookie name is cleared');
    assert.match(cleared, new RegExp(`^${SESSION_COOKIE_NAME}=;`));
    assert.match(cleared, /Expires=Thu, 01 Jan 1970/i);
    assert.deepEqual(attrs(cleared), attrs(set));
    assert.doesNotMatch(cleared, /Domain=/i);
  });
});

test('logout only revokes this browser; other devices and the account survive', async () => {
  await withServer(async (request) => {
    const account = await newVerifiedAccount(request);
    const phone = await request('/api/auth/login', {
      method: 'POST',
      body: { email: account.email, password: account.password },
    });
    assert.equal(await prisma.session.count({ where: { userId: account.userId } }), 2);

    await request('/api/auth/logout', { method: 'POST', cookie: phone.cookie });
    assert.equal(await prisma.session.count({ where: { userId: account.userId } }), 1);
    const desktop = await request('/api/auth/me', { cookie: account.cookie });
    assert.equal(desktop.response.status, 200);
  });
});

test('logout is idempotent and works without a cookie or Origin (WebView retries)', async () => {
  await withServer(async (request) => {
    const account = await newVerifiedAccount(request);
    const first = await request('/api/auth/logout', { method: 'POST', cookie: account.cookie, origin: null });
    assert.equal(first.response.status, 200);
    const second = await request('/api/auth/logout', { method: 'POST', cookie: account.cookie });
    assert.equal(second.response.status, 200);
    const none = await request('/api/auth/logout', { method: 'POST' });
    assert.equal(none.response.status, 200);
    assert.ok(named(none.setCookie, SESSION_COOKIE_NAME), 'still expires any cookie');
  });
});

test('logout still expires the cookie when the session store errors', async (t) => {
  await withServer(async (request) => {
    const account = await newVerifiedAccount(request);
    // Prisma model delegates are proxies, so swap the delegate on the client.
    const realSession = prisma.session;
    const restore = () => {
      Object.defineProperty(prisma, 'session', { configurable: true, get: () => realSession });
    };
    const failing = new Proxy(realSession, {
      get(target, key) {
        if (key === 'deleteMany') return async () => { throw new Error('database unavailable'); };
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    Object.defineProperty(prisma, 'session', { configurable: true, get: () => failing });
    t.after(restore);
    assert.equal(prisma.session, failing, 'delegate swapped');
    const out = await request('/api/auth/logout', { method: 'POST', cookie: account.cookie });
    assert.equal(out.response.status, 500, 'client is told so it can retry');
    const cleared = named(out.setCookie, SESSION_COOKIE_NAME);
    assert.ok(cleared, 'Set-Cookie survives the error response');
    assert.match(cleared, /Expires=Thu, 01 Jan 1970/i);
    restore();
    assert.equal(prisma.session, realSession, 'delegate restored');

    // The client retry (pending-logout on next load) then finishes the job.
    const retry = await request('/api/auth/logout', { method: 'POST', cookie: account.cookie });
    assert.equal(retry.response.status, 200);
    const after = await request('/api/auth/session', { cookie: account.cookie });
    assert.equal(after.payload.data.user, null);
  });
});

test('logout from another site is refused (no logout CSRF)', async () => {
  await withServer(async (request) => {
    const account = await newVerifiedAccount(request);
    const evil = await request('/api/auth/logout', {
      method: 'POST',
      cookie: account.cookie,
      origin: 'https://evil.example',
    });
    assert.equal(evil.response.status, 403);
    const still = await request('/api/auth/me', { cookie: account.cookie });
    assert.equal(still.response.status, 200);
  });
});

test('production: __Host- cookie is set and cleared with Secure, Path=/, SameSite=Lax, no Domain', async () => {
  const script = fileURLToPath(new URL('./fixtures/production-logout.mjs', import.meta.url));
  const env = { ...process.env, NODE_ENV: 'production' };
  delete env.AUTH_TEST_RETURN_TOKEN;
  const { stdout } = await run(process.execPath, [script], { env, cwd: fileURLToPath(new URL('..', import.meta.url)) });
  const report = JSON.parse(stdout.trim().split('\n').filter((line) => line.startsWith('{')).pop());

  assert.equal(report.name, '__Host-volteniq_session');
  const set = named(report.set, report.name);
  assert.ok(set);
  assert.deepEqual(attrs(set), { path: '/', httponly: true, secure: true, samesite: 'lax' });
  assert.equal(report.beforeUser, true);

  assert.equal(report.logoutStatus, 200);
  const cleared = named(report.cleared, report.name);
  assert.ok(cleared);
  assert.match(cleared, /^__Host-volteniq_session=;/);
  assert.match(cleared, /Expires=Thu, 01 Jan 1970/i);
  assert.deepEqual(attrs(cleared), attrs(set), '__Host- clear must mirror the set attributes');
  // The legacy name is cleared too, in case an older deploy left it behind.
  assert.ok(named(report.cleared, 'volteniq_session'));

  assert.equal(report.afterUser, null);
  assert.equal(report.meStatus, 401);
  assert.equal(report.remainingSessions, 0);
  assert.equal(report.userStillExists, true);
});

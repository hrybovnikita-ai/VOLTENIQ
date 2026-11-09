/**
 * Disposable end-to-end auth verification. Does not print passwords or raw cookies.
 */
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const api = process.env.API_ORIGIN || 'http://127.0.0.1:5004';
const prisma = new PrismaClient();
const email = `qa_${randomUUID().slice(0, 8)}@volteniq.test`;
const password = `Tmp_${randomUUID().replace(/-/g, '').slice(0, 12)}!`;

const results = [];
function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function cookieParts(setCookie = []) {
  return setCookie.map((value) => String(value).split(';')[0]).filter(Boolean);
}

function findSessionCookie(setCookie = []) {
  return setCookie.find((value) => /^volteniq_session=|^__Host-volteniq_session=/.test(String(value)));
}

async function request(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${api}${path}`, {
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
  return {
    status: response.status,
    payload,
    setCookie,
    cookie: cookieParts(setCookie).join('; '),
  };
}

try {
  const registered = await request('/api/auth/register', {
    method: 'POST',
    body: { email, password },
  });
  if (registered.status === 201 && registered.payload?.data?.user?.email === email) {
    pass('register creates account', `userId=${registered.payload.data.user.id}`);
  } else {
    fail('register creates account', `status=${registered.status}`);
  }

  if (!registered.payload?.data?.token) pass('register does not return JWT token');
  else fail('register does not return JWT token');

  if (!('password' in (registered.payload?.data?.user || {}))) pass('register response hides password hash');
  else fail('register response hides password hash');

  const sessionHeader = findSessionCookie(registered.setCookie);
  if (sessionHeader && /HttpOnly/i.test(sessionHeader) && /SameSite=Lax/i.test(sessionHeader) && /Max-Age=2592000/i.test(sessionHeader)) {
    pass('register sets 30-day HttpOnly SameSite=Lax cookie');
  } else {
    fail('register sets 30-day HttpOnly SameSite=Lax cookie', String(sessionHeader || 'missing'));
  }

  const dbUser = await prisma.user.findUnique({ where: { email } });
  if (dbUser && await bcrypt.compare(password, dbUser.password)) {
    pass('password stored as bcrypt hash in PostgreSQL');
  } else {
    fail('password stored as bcrypt hash in PostgreSQL');
  }

  const me = await request('/api/auth/me', { cookie: registered.cookie });
  if (me.status === 200 && me.payload?.data?.user?.email === email) {
    pass('auto sign-in session restores via /api/auth/me');
  } else {
    fail('auto sign-in session restores via /api/auth/me', `status=${me.status}`);
  }

  const sessions = await prisma.session.findMany({ where: { userId: dbUser.id } });
  const days = sessions[0]
    ? (sessions[0].expiresAt.getTime() - Date.now()) / 86_400_000
    : 0;
  if (sessions.length >= 1 && days > 29.5 && days <= 30.01) {
    pass('session row expires in ~30 days', `days=${days.toFixed(2)}`);
  } else {
    fail('session row expires in ~30 days', `count=${sessions.length} days=${days}`);
  }

  // Simulate browser restart: reuse only the cookie header, no in-memory auth state.
  const restored = await request('/api/auth/me', { cookie: registered.cookie });
  if (restored.status === 200 && restored.payload?.data?.user?.id === dbUser.id) {
    pass('session survives simulated browser restart');
  } else {
    fail('session survives simulated browser restart');
  }

  const badLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password: `${password}-wrong` },
  });
  if (badLogin.status === 401 && !findSessionCookie(badLogin.setCookie)) {
    pass('invalid password rejected without new session');
  } else {
    fail('invalid password rejected without new session');
  }

  const ghostEmail = `ghost_${randomUUID().slice(0, 8)}@volteniq.test`;
  const before = await prisma.user.count({ where: { email: ghostEmail } });
  const ghostLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: ghostEmail, password },
  });
  const after = await prisma.user.count({ where: { email: ghostEmail } });
  if (ghostLogin.status === 401 && before === after) {
    pass('failed login never creates an account');
  } else {
    fail('failed login never creates an account');
  }

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (login.status === 200 && findSessionCookie(login.setCookie)) {
    pass('login issues a new HttpOnly session cookie');
  } else {
    fail('login issues a new HttpOnly session cookie');
  }

  const providers = await request('/api/auth/providers');
  if (providers.status === 200 && providers.payload?.data?.google === true) {
    pass('Google provider is enabled on backend');
  } else {
    fail('Google provider is enabled on backend', JSON.stringify(providers.payload));
  }

  const badGoogle = await request('/api/auth/firebase', {
    method: 'POST',
    body: { idToken: 'not-a-real-token' },
  });
  if (badGoogle.status === 401) pass('Google/Firebase rejects invalid ID tokens');
  else fail('Google/Firebase rejects invalid ID tokens', `status=${badGoogle.status}`);

  const logout = await request('/api/auth/logout', {
    method: 'POST',
    cookie: login.cookie || registered.cookie,
  });
  const meAfter = await request('/api/auth/me', { cookie: login.cookie || registered.cookie });
  if (logout.status === 200 && meAfter.status === 401) {
    pass('logout revokes session');
  } else {
    fail('logout revokes session');
  }

  const catalog = await request('/api/products?limit=1');
  if (catalog.status === 200 && Array.isArray(catalog.payload?.data?.products)) {
    pass('product catalog still available');
  } else {
    fail('product catalog still available');
  }

  // Cleanup disposable account
  await prisma.session.deleteMany({ where: { userId: dbUser.id } });
  await prisma.user.delete({ where: { id: dbUser.id } });
  pass('disposable test account cleaned up', `email=${email}`);
} catch (error) {
  fail('unexpected error', error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  const failed = results.filter((item) => !item.ok).length;
  console.log(`\nSummary: ${results.length - failed}/${results.length} passed`);
  if (failed) process.exitCode = 1;
}

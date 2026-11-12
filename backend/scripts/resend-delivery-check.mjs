import { createHash, randomBytes } from 'node:crypto';
import { config } from '../src/config.js';
import { prisma } from '../src/db/prisma.js';
import {
  buildVerifyEmailContent,
  sendAuthEmail,
} from '../src/services/mailService.js';
import { findUserByEmail, isEmailVerified } from '../src/services/userService.js';
import { EMAIL_VERIFY_TTL_MS } from '../src/services/authTokenService.js';

const email = process.env.RESEND_TEST_EMAIL;
const password = process.env.RESEND_TEST_PASSWORD;
const origin = config.appOrigin || 'http://localhost:5173';

if (!email || !password) {
  console.log(JSON.stringify({
    ok: false,
    error: 'Set RESEND_TEST_EMAIL and RESEND_TEST_PASSWORD in the environment (do not hardcode secrets).',
  }));
  process.exit(1);
}

if (config.authTestReturnToken) {
  console.log(JSON.stringify({ ok: false, error: 'AUTH_TEST_RETURN_TOKEN_must_stay_disabled' }));
  process.exit(1);
}

const account = await findUserByEmail(email);
if (!account) {
  console.log(JSON.stringify({ ok: false, error: 'account_not_found', email }));
  process.exit(1);
}

const summary = {
  email,
  verifiedBefore: isEmailVerified(account),
  hasGoogle: Boolean(account.googleId),
  authTestReturnToken: config.authTestReturnToken,
  resendConfigured: Boolean(config.resendApiKey),
  mailFromSet: Boolean(config.mailFrom),
  appOrigin: origin,
};

await prisma.authToken.updateMany({
  where: { userId: account.id, type: 'EMAIL_VERIFY', usedAt: null },
  data: { usedAt: new Date() },
});

const raw = randomBytes(32).toString('hex');
const tokenHash = createHash('sha256').update(raw).digest('hex');
const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);

await prisma.authToken.create({
  data: {
    userId: account.id,
    type: 'EMAIL_VERIFY',
    tokenHash,
    expiresAt,
  },
});

const content = buildVerifyEmailContent({ origin, email, token: raw });

try {
  const sent = await sendAuthEmail({
    to: email,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
  summary.sent = true;
  summary.provider = sent.provider;
  summary.resendId = sent.id || null;
} catch (err) {
  summary.sent = false;
  summary.error = err.message;
  summary.code = err.code || null;
  summary.detail = err.detail || null;
  console.log(JSON.stringify(summary, null, 2));
  await prisma.$disconnect();
  process.exit(1);
}

summary.linkHost = new URL(content.url).origin;
summary.linkPath = new URL(content.url).pathname;
summary.linkHasEmail = true;
summary.linkHasToken = true;
summary.linkTokenLen = raw.length;

// Exercise verify → session → logout → login → session using the same token that was emailed.
const verifyRes = await fetch('http://127.0.0.1:5004/api/auth/verify-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5173',
  },
  body: JSON.stringify({ email, token: raw }),
});
const verifyBody = await verifyRes.json().catch(() => ({}));
summary.verifyStatus = verifyRes.status;
summary.verifyOk = verifyRes.ok;
summary.verifyHasUser = Boolean(verifyBody?.data?.user?.id);

const verifyCookie = (verifyRes.headers.getSetCookie?.() || [])
  .map((v) => String(v).split(';')[0])
  .filter(Boolean)
  .join('; ');

const session1 = await fetch('http://127.0.0.1:5004/api/auth/session', {
  headers: { Origin: 'http://localhost:5173', Cookie: verifyCookie },
});
const session1Body = await session1.json().catch(() => ({}));
summary.sessionAfterVerify = Boolean(session1Body?.data?.user?.id);

const logoutRes = await fetch('http://127.0.0.1:5004/api/auth/logout', {
  method: 'POST',
  headers: { Origin: 'http://localhost:5173', Cookie: verifyCookie },
});
summary.logoutStatus = logoutRes.status;

const session2 = await fetch('http://127.0.0.1:5004/api/auth/session', {
  headers: { Origin: 'http://localhost:5173', Cookie: verifyCookie },
});
const session2Body = await session2.json().catch(() => ({}));
summary.sessionAfterLogout = session2Body?.data?.user ?? null;

const loginRes = await fetch('http://127.0.0.1:5004/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5173',
  },
  body: JSON.stringify({ email, password }),
});
const loginBody = await loginRes.json().catch(() => ({}));
summary.loginStatus = loginRes.status;
summary.loginCode = loginBody?.code || null;

if (loginRes.ok) {
  const loginCookie = (loginRes.headers.getSetCookie?.() || [])
    .map((v) => String(v).split(';')[0])
    .filter(Boolean)
    .join('; ');
  const session3 = await fetch('http://127.0.0.1:5004/api/auth/session', {
    headers: { Origin: 'http://localhost:5173', Cookie: loginCookie },
  });
  const session3Body = await session3.json().catch(() => ({}));
  summary.sessionAfterLogin = Boolean(session3Body?.data?.user?.id);

  await fetch('http://127.0.0.1:5004/api/auth/logout', {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', Cookie: loginCookie },
  });
} else {
  summary.sessionAfterLogin = false;
  summary.loginNote = summary.hasGoogle
    ? 'Password login may fail for Google-linked accounts without a known password; verify/session/logout already exercised.'
    : 'Password login failed with provided test password.';
}

console.log(JSON.stringify(summary, null, 2));
await prisma.$disconnect();

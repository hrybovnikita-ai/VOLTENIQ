import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { config } from '../config.js';
import {
  buildResetPasswordContent,
  buildVerifyEmailContent,
  sendAuthEmail,
} from './mailService.js';

export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function issueRawToken() {
  return randomBytes(32).toString('hex');
}

async function createToken(userId, type, ttlMs) {
  const raw = issueRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + ttlMs);

  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: { userId, type, tokenHash, expiresAt },
    }),
  ]);

  return { raw, expiresAt };
}

export async function assertResendCooldown(userId, type) {
  const latest = await prisma.authToken.findFirst({
    where: { userId, type },
    orderBy: { createdAt: 'desc' },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const err = new Error('Please wait before requesting another email.');
    err.status = 429;
    throw err;
  }
}

export async function sendEmailVerification(user) {
  await assertResendCooldown(user.id, 'EMAIL_VERIFY');
  const { raw } = await createToken(user.id, 'EMAIL_VERIFY', EMAIL_VERIFY_TTL_MS);
  const content = buildVerifyEmailContent({
    origin: config.appOrigin,
    email: user.email,
    token: raw,
  });
  await sendAuthEmail({
    to: user.email,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  const result = { email: user.email, sent: true };
  if (config.authTestReturnToken) result.token = raw;
  return result;
}

export async function sendPasswordReset(user) {
  await assertResendCooldown(user.id, 'PASSWORD_RESET');
  const { raw } = await createToken(user.id, 'PASSWORD_RESET', PASSWORD_RESET_TTL_MS);
  const content = buildResetPasswordContent({
    origin: config.appOrigin,
    email: user.email,
    token: raw,
  });
  await sendAuthEmail({
    to: user.email,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  const result = { email: user.email, sent: true };
  if (config.authTestReturnToken) result.token = raw;
  return result;
}

export async function consumeAuthToken({ email, token, type }) {
  if (!email || !token || typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
    const err = new Error('This link is invalid or incomplete.');
    err.status = 400;
    throw err;
  }

  const tokenHash = hashToken(token.toLowerCase());
  const row = await prisma.authToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!row || row.type !== type) {
    const err = new Error('This link is invalid or has already been used.');
    err.status = 400;
    throw err;
  }
  if (row.usedAt) {
    const err = new Error('This link has already been used. Request a new one.');
    err.status = 400;
    throw err;
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    const err = new Error('This link has expired. Request a new one.');
    err.status = 400;
    throw err;
  }
  if (row.user.email.toLowerCase() !== String(email).toLowerCase()) {
    const err = new Error('This link does not match the email address.');
    err.status = 400;
    throw err;
  }

  await prisma.authToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });

  return row.user;
}

export async function clearUserAuthTokens(userId, type = null) {
  await prisma.authToken.deleteMany({
    where: type ? { userId, type } : { userId },
  });
}

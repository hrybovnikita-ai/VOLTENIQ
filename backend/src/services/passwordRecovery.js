import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { consumeAuthToken, sendPasswordReset } from './authTokenService.js';
import { isMailConfigured } from './mailService.js';
import { revokeAllUserSessions } from './sessionService.js';

/**
 * Request a password reset email. Fails closed if mail is not configured.
 * Always returns a generic shape to the route for eligible handling.
 */
export async function requestPasswordReset(email) {
  if (!isMailConfigured()) {
    const err = new Error('Email delivery is not configured. Set RESEND_API_KEY and MAIL_FROM.');
    err.status = 503;
    err.code = 'mail_not_configured';
    throw err;
  }

  const normalized = String(email || '').toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  // Do not reveal whether the account exists — but still require mail to be configured.
  if (!user) {
    return { sent: false, reason: 'not_found' };
  }

  // Google-only accounts cannot use password reset.
  if (!user.password || user.password === 'GOOGLE_ONLY' || user.password.startsWith('GOOGLE_ONLY')) {
    return { sent: false, reason: 'google_only' };
  }

  const result = await sendPasswordReset(user);
  return { sent: true, ...result };
}

export async function resetPasswordWithToken(email, token, password) {
  const user = await consumeAuthToken({
    email,
    token,
    type: 'PASSWORD_RESET',
  });

  if (!user.password || user.password === 'GOOGLE_ONLY' || user.password.startsWith('GOOGLE_ONLY')) {
    const err = new Error('No password account is available for this email. If you registered with Google, use Continue with Google.');
    err.status = 400;
    throw err;
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        // Completing reset via mailbox ownership also verifies the email.
        emailVerifiedAt: user.emailVerifiedAt || new Date(),
      },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
  });

  await revokeAllUserSessions(user.id);
  return { email: user.email };
}

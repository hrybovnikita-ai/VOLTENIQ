import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';

export async function resetPasswordWithEmailLink(email, code, password) {
  const key = process.env.FIREBASE_WEB_API_KEY;
  if (!key) throw Object.assign(new Error('Recovery is unavailable'), { status: 503 });
  // Firebase authenticates the mailbox and consumes the one-time code.
  const url = new URL('https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink');
  url.searchParams.set('key', key);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, oobCode: code }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    if (response.status >= 500) throw Object.assign(new Error('Provider unavailable'), { status: 503 });
    throw Object.assign(new Error('This recovery link could not be verified. Request a new link for this email.'), { status: 400 });
  }
  const identity = await response.json();
  if (!identity.email || identity.email.toLowerCase() !== email.toLowerCase()) {
    throw Object.assign(new Error('Recovery email does not match.'), { status: 400 });
  }
  const hashed = await bcrypt.hash(password, 10);
  await prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.googleId || user.firebaseUid) {
      throw Object.assign(new Error('No password account is available for this email. If you registered with Google, use Continue with Google.'), { status: 400 });
    }
    await tx.user.update({ where: { id: user.id }, data: { password: hashed } });
    await tx.session.deleteMany({ where: { userId: user.id } });
  });
}

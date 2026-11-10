import { createClerkClient, verifyToken } from '@clerk/backend';
import { config } from '../config.js';

function clerkUnavailable() {
  const err = new Error('Clerk authentication is not configured');
  err.status = 503;
  return err;
}

export async function verifyClerkSessionToken(token) {
  if (!config.clerkSecretKey) throw clerkUnavailable();
  if (!token || typeof token !== 'string') {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }

  let payload;
  try {
    payload = await verifyToken(token, { secretKey: config.clerkSecretKey, authorizedParties: config.corsOrigin });
  } catch {
    const err = new Error('Invalid or expired Clerk session');
    err.status = 401;
    throw err;
  }

  const clerkId = payload.sub;
  if (!clerkId) {
    const err = new Error('Invalid or expired Clerk session');
    err.status = 401;
    throw err;
  }

  const client = createClerkClient({ secretKey: config.clerkSecretKey });
  const clerkUser = await client.users.getUser(clerkId);
  const primary = clerkUser.emailAddresses?.find(
    (entry) => entry.id === clerkUser.primaryEmailAddressId
  ) || clerkUser.emailAddresses?.[0];

  const email = primary?.emailAddress;
  if (!email) {
    const err = new Error('Clerk account email is required');
    err.status = 400;
    throw err;
  }

  const googleAccount = clerkUser.externalAccounts?.find((account) => (
    account.provider === 'oauth_google'
    && account.emailAddress?.toLowerCase() === email.toLowerCase()
  )) || clerkUser.externalAccounts?.find((account) => account.provider === 'oauth_google');

  const googleVerified = Boolean(
    googleAccount
    && googleAccount.verification?.status === 'verified'
    && googleAccount.emailAddress?.toLowerCase() === email.toLowerCase()
  );

  const emailVerified = primary?.verification?.status === 'verified' || googleVerified;

  if (!emailVerified) {
    const err = new Error('Verify your email with Google/Clerk before continuing');
    err.status = 401;
    throw err;
  }

  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim();

  return {
    clerkId,
    email,
    emailVerified: true,
    googleVerified,
    name: name || null,
    googleId: googleAccount?.providerUserId || null,
    avatarUrl: clerkUser.imageUrl || null,
  };
}

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
    payload = await verifyToken(token, { secretKey: config.clerkSecretKey });
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
  );
  const email = primary?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress;
  if (!email) {
    const err = new Error('Clerk account email is required');
    err.status = 400;
    throw err;
  }

  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim();

  return {
    clerkId,
    email,
    name: name || null,
  };
}

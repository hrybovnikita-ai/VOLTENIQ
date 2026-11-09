import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config.js';

const JWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  )
);

export async function verifyFirebaseIdToken(idToken) {
  if (!config.firebaseProjectId) {
    const err = new Error('Firebase is not configured on the server');
    err.status = 503;
    throw err;
  }

  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'sub'],
      audience: config.firebaseProjectId,
      issuer: `https://securetoken.google.com/${config.firebaseProjectId}`,
    });

    if (!payload.sub || !payload.email || payload.email_verified !== true || payload.firebase?.sign_in_provider !== 'google.com') {
      const err = new Error('Firebase token is missing required claims');
      err.status = 401;
      throw err;
    }

    return {
      uid: String(payload.sub),
      email: String(payload.email).toLowerCase(),
      name: payload.name ? String(payload.name) : '',
      picture: payload.picture ? String(payload.picture) : null,
      signInProvider: payload.firebase?.sign_in_provider || null,
    };
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Invalid or expired Firebase token');
    err.status = 401;
    throw err;
  }
}

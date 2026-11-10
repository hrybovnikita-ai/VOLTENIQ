import rateLimit from 'express-rate-limit';

function clientKey(req) {
  return String(req.ip || req.headers['x-forwarded-for'] || 'unknown')
    .split(',')[0]
    .trim();
}

/** Shared factory so auth routes get consistent 429 JSON. */
function createAuthLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientKey,
    message: { success: false, message },
    // Vercel / local trust proxy is already enabled on the app.
    validate: { trustProxy: false },
  });
}

export const loginLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many sign-in attempts. Please wait and try again.',
});

export const registerLimiter = createAuthLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many registration attempts. Please wait and try again.',
});

export const resetLimiter = createAuthLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many password reset attempts. Please wait and try again.',
});

export const oauthBridgeLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: 'Too many authentication attempts. Please wait and try again.',
});

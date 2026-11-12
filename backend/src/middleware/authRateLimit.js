import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/** Shared factory so auth routes get consistent 429 JSON. */
function createAuthLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const forwarded = String(req.headers['x-forwarded-for'] || '')
        .split(',')[0]
        .trim();
      return ipKeyGenerator(forwarded || req.ip || '127.0.0.1');
    },
    message: { success: false, message },
    // App already sets trust proxy; disable IPv6 static check noise after using ipKeyGenerator.
    validate: { trustProxy: false, keyGeneratorIpFallback: false },
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

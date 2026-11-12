import { config } from '../config.js';

/**
 * Same-origin reverse proxy for Firebase Auth's hosted helper pages
 * (/__/auth/handler, /__/auth/iframe, /__/firebase/init.json).
 *
 * Safari ITP, iOS WebKit and Chrome storage partitioning block the
 * cross-site <project>.firebaseapp.com iframe that signInWithRedirect relies
 * on. Serving these paths from the storefront origin and using that origin as
 * the Firebase authDomain keeps the whole OAuth round-trip first-party.
 * See https://firebase.google.com/docs/auth/web/redirect-best-practices (option 3).
 *
 * Only GET/HEAD are forwarded, and store cookies are never sent upstream.
 */
export const FIREBASE_PROXY_PREFIXES = ['/__/auth/', '/__/firebase/'];

const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'cache-control',
  'expires',
  'last-modified',
  'etag',
  'content-security-policy',
  'x-frame-options',
  'cross-origin-opener-policy',
  'referrer-policy',
];

export function firebaseProxyTarget() {
  const explicit = String(process.env.FIREBASE_AUTH_PROXY_TARGET || '').trim().replace(/\/$/, '');
  if (explicit) return /^https:\/\//i.test(explicit) ? explicit : `https://${explicit}`;
  if (!config.firebaseProjectId) return null;
  return `https://${config.firebaseProjectId}.firebaseapp.com`;
}

export function isFirebaseProxyPath(path) {
  const value = String(path || '');
  if (value.includes('..') || value.includes('\\')) return false;
  return FIREBASE_PROXY_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function createFirebaseAuthProxyMiddleware({ fetchImpl = (...args) => globalThis.fetch(...args) } = {}) {
  return async function firebaseAuthProxy(req, res, next) {
    if (!isFirebaseProxyPath(req.path)) return next();
    const target = firebaseProxyTarget();
    if (!target) return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.set('Allow', 'GET, HEAD');
      return res.status(405).end();
    }

    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    const upstreamUrl = `${target}${req.path}${query}`;
    try {
      const upstream = await fetchImpl(upstreamUrl, {
        method: req.method,
        redirect: 'manual',
        headers: {
          accept: req.get('accept') || '*/*',
          'accept-language': req.get('accept-language') || 'en',
          'user-agent': req.get('user-agent') || 'volteniq-firebase-proxy',
        },
      });

      res.status(upstream.status);
      for (const name of FORWARD_RESPONSE_HEADERS) {
        const value = upstream.headers.get(name);
        if (value) res.set(name, value);
      }
      const location = upstream.headers.get('location');
      if (location) res.set('location', location);

      if (req.method === 'HEAD' || upstream.status === 204 || upstream.status === 304) return res.end();
      const body = Buffer.from(await upstream.arrayBuffer());
      return res.send(body);
    } catch (error) {
      return next(Object.assign(new Error('Firebase auth helper is unavailable. Please try again.'), {
        status: 502,
        cause: error,
      }));
    }
  };
}

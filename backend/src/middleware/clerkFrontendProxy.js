import { Readable } from 'node:stream';
import { clerkFrontendApiProxy } from '@clerk/backend/proxy';
import { config } from '../config.js';

export const CLERK_PROXY_PATH = '/__clerk';

/**
 * @clerk/express forwards proxy Set-Cookie with response.setHeader() inside
 * headers.forEach(). Each call replaces the previous value, so Clerk's
 * __client / __client_uat cookies are dropped and only the last cookie
 * (often Cloudflare _cfuvid) survives — OAuth then fails with no_valid_client.
 *
 * This middleware uses clerkFrontendApiProxy directly and appends every
 * Set-Cookie from getSetCookie(). Domain is stripped so cookies are host-only
 * on the public app origin (required when FAPI stamps Domain=frontend-api.clerk.dev).
 */

export function rewriteClerkSetCookie(setCookie) {
  if (!setCookie || typeof setCookie !== 'string') return setCookie;
  return setCookie
    .replace(/;\s*Domain=[^;]*/gi, '')
    .replace(/;;+/g, ';')
    .replace(/;\s*$/g, '');
}

function stripStoreSessionCookie(cookieHeader) {
  if (!cookieHeader) return cookieHeader;
  return String(cookieHeader)
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && !/^(?:__Host-)?volteniq_session=/.test(part))
    .join('; ');
}

function publicProxyOrigin(req) {
  const configured = config.clerkProxyUrl;
  try {
    if (configured) {
      const url = new URL(configured);
      return { proto: url.protocol.replace(':', ''), host: url.host };
    }
  } catch {
    // fall through
  }

  const forwardedHost = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim();
  const host = forwardedHost || req.get('host') || 'localhost';
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const proto = forwardedProto || req.protocol || 'http';
  return { proto, host };
}

function buildProxyRequest(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    const lower = key.toLowerCase();
    if (lower === 'set-cookie') continue;
    // Cookie values must stay semicolon-separated, never comma-joined.
    if (lower === 'cookie') {
      const cookie = Array.isArray(value) ? value.join('; ') : String(value);
      headers.set('cookie', stripStoreSessionCookie(cookie));
      continue;
    }
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }

  const { proto, host } = publicProxyOrigin(req);
  headers.set('x-forwarded-host', host);
  headers.set('x-forwarded-proto', proto);

  const url = new URL(req.originalUrl || req.url, `${proto}://${host}`);
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(String(req.method || '').toUpperCase());

  return new Request(url.toString(), {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? 'half' : undefined,
  });
}

function copyProxyResponse(proxyResponse, res) {
  res.status(proxyResponse.status);

  proxyResponse.headers.forEach((value, key) => {
    if (String(key).toLowerCase() === 'set-cookie') return;
    res.setHeader(key, value);
  });

  const cookies = typeof proxyResponse.headers.getSetCookie === 'function'
    ? proxyResponse.headers.getSetCookie()
    : [];

  for (const cookie of cookies) {
    res.appendHeader('Set-Cookie', rewriteClerkSetCookie(cookie));
  }
}

export function createClerkFrontendProxyMiddleware() {
  const publishableKey = config.clerkPublishableKey;
  const secretKey = config.clerkSecretKey;
  if (!publishableKey || !secretKey) return null;

  return async function clerkFrontendProxy(req, res, next) {
    const path = String(req.originalUrl || req.url || '').split('?')[0];
    if (path !== CLERK_PROXY_PATH && !path.startsWith(`${CLERK_PROXY_PATH}/`)) {
      return next();
    }

    try {
      const proxyRequest = buildProxyRequest(req);
      const proxyResponse = await clerkFrontendApiProxy(proxyRequest, {
        proxyPath: CLERK_PROXY_PATH,
        publishableKey,
        secretKey,
      });

      copyProxyResponse(proxyResponse, res);

      if (!proxyResponse.body) {
        res.end();
        return;
      }

      const reader = proxyResponse.body.getReader();
      new Readable({
        async read() {
          try {
            const { done, value } = await reader.read();
            if (done) this.push(null);
            else this.push(Buffer.from(value));
          } catch (error) {
            this.destroy(error instanceof Error ? error : new Error(String(error)));
          }
        },
      }).pipe(res);
    } catch (error) {
      next(error);
    }
  };
}

import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { createClerkFrontendProxyMiddleware } from './middleware/clerkFrontendProxy.js';
import { createFirebaseAuthProxyMiddleware } from './middleware/firebaseAuthProxy.js';
import cartRoutes from './routes/cart.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import favoriteRoutes from './routes/favorites.js';
import adminRoutes from './routes/admin.js';
import alertRoutes from './routes/alerts.js';
import assistantRoutes from './routes/assistant.js';
import chatRoutes from './routes/chats.js';
import reviewRoutes from './routes/reviews.js';
import promoRoutes from './routes/promos.js';

const app = express();

export function isSameOrigin(req, origin) {
  try {
    const parsed = new URL(origin);
    const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
    const host = (forwardedHost || req.headers.host || '').toLowerCase();
    if (!host || parsed.host.toLowerCase() !== host) return false;
    // In production only HTTPS pages count as same-origin.
    return config.nodeEnv !== 'production' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Required behind Vercel / reverse proxies so Secure cookies and IPs work.
app.set('trust proxy', 1);

/**
 * Clerk Frontend API proxy must run before body parsers so OAuth callbacks
 * and clerk-js assets stream with the original request body.
 * Custom bridge (not @clerk/express setHeader loop) preserves every Set-Cookie
 * — required for __client during Google OAuth. Scoped to /__clerk only.
 */
const clerkFrontendProxy = config.clerkEnabled && createClerkFrontendProxyMiddleware();
if (clerkFrontendProxy) {
  app.use(clerkFrontendProxy);
}

// Firebase Auth helper pages served first-party for Safari/iOS redirect sign-in.
app.use(createFirebaseAuthProxyMiddleware());

app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    // Same-origin browser calls and non-browser tools may omit Origin.
    // Browsers send Origin on same-origin POSTs too, so allow the request's own
    // host (any Vercel alias or custom domain) in addition to the allowlist.
    // A cross-site page cannot forge Host, so this does not widen CSRF exposure.
    const allowed = !origin || config.corsOrigin.includes(origin) || isSameOrigin(req, origin);
    if (!allowed) {
      return callback(Object.assign(new Error('Origin is not allowed'), { status: 403 }));
    }
    return callback(null, {
      origin: Boolean(origin),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'online',
    service: 'VOLTENIQ API',
    demoMode: config.demoMode,
    clerkProxy: Boolean(clerkFrontendProxy),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/cart', cartRoutes);
app.use('/api/auth', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/products/:productId/reviews', reviewRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;

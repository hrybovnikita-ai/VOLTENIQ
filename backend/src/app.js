import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { createClerkFrontendProxyMiddleware } from './middleware/clerkFrontendProxy.js';
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

// Required behind Vercel / reverse proxies so Secure cookies and IPs work.
app.set('trust proxy', 1);

/**
 * Clerk Frontend API proxy must run before body parsers so OAuth callbacks
 * and clerk-js assets stream with the original request body.
 * Custom bridge (not @clerk/express setHeader loop) preserves every Set-Cookie
 * — required for __client during Google OAuth. Scoped to /__clerk only.
 */
const clerkFrontendProxy = createClerkFrontendProxyMiddleware();
if (clerkFrontendProxy) {
  app.use(clerkFrontendProxy);
}

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin browser calls and non-browser tools may omit Origin.
      if (!origin || config.corsOrigin.includes(origin)) {
        return callback(null, true);
      }
      return callback(Object.assign(new Error('Origin is not allowed'), { status: 403 }));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'online',
    service: 'VOLTENIQ API',
    demoMode: config.demoMode,
    clerkProxy: Boolean(config.clerkSecretKey && config.clerkPublishableKey),
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

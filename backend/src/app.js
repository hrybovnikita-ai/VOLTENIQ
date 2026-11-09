import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import cartRoutes from './routes/cart.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import favoriteRoutes from './routes/favorites.js';
import adminRoutes from './routes/admin.js';
import alertRoutes from './routes/alerts.js';
import chatRoutes from './routes/chats.js';

const app = express();

// Required behind Vercel / reverse proxies so Secure cookies and IPs work.
app.set('trust proxy', 1);

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
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'VOLTENIQ API',
    demoMode: config.demoMode,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/cart', cartRoutes);
app.use('/api/auth', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;

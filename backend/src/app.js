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

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser tools (no Origin) and configured Vite ports
      if (!origin || config.corsOrigin.includes(origin) || config.corsOrigin.includes('*')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
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
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;

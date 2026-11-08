import { randomUUID } from 'crypto';
import { demoProducts } from '../data/products.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId() {
  return randomUUID().replace(/-/g, '').slice(0, 24);
}

async function buildStore() {
  const now = Date.now();
  const products = demoProducts.map((p, index) => ({
    id: `prod-${String(index + 1).padStart(3, '0')}`,
    ...clone(p),
    createdAt: new Date(now - index * 3600_000).toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  const priceHistory = products.flatMap((p) => [
    {
      id: createId(),
      productId: p.id,
      price: Math.round(Number(p.price) * 1.1 * 100) / 100,
      recordedAt: new Date(now - 14 * 24 * 3600_000).toISOString(),
    },
    {
      id: createId(),
      productId: p.id,
      price: Math.round(Number(p.price) * 1.04 * 100) / 100,
      recordedAt: new Date(now - 7 * 24 * 3600_000).toISOString(),
    },
    {
      id: createId(),
      productId: p.id,
      price: Number(p.price),
      recordedAt: new Date().toISOString(),
    },
  ]);

  return {
    products,
    orders: [],
    favorites: [],
    priceAlerts: [],
    priceHistory,
    notifications: [],
    chatConversations: [],
    chatMessages: [],
  };
}

const storePromise = buildStore();

export async function getDemoStore() {
  return storePromise;
}

export { createId, clone };

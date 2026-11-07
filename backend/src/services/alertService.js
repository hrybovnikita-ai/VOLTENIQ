import { config } from '../config.js';
import { prisma } from '../db/prisma.js';
import { createId, getDemoStore } from '../db/demoStore.js';
import { getProductById } from './productService.js';

function publicAlert(alert, product) {
  const currentPrice = Number(product?.price) || Number(alert.subscribedPrice) || 0;
  const subscribedPrice = Number(alert.subscribedPrice) || 0;
  const dropped = currentPrice < subscribedPrice - 0.009;
  return {
    id: alert.id,
    productId: alert.productId,
    userId: alert.userId,
    subscribedPrice,
    targetPrice: alert.targetPrice ?? null,
    currentPrice,
    dropped,
    dropAmount: dropped ? Math.round((subscribedPrice - currentPrice) * 100) / 100 : 0,
    notified: Boolean(alert.notified),
    createdAt: alert.createdAt,
    product: product
      ? {
          id: product.id,
          name: product.name,
          slug: product.slug,
          image: product.image,
          price: product.price,
          category: product.category,
        }
      : null,
  };
}

export async function listAlertsForUser(userId) {
  if (config.demoMode) {
    const store = await getDemoStore();
    const mine = store.priceAlerts.filter((a) => a.userId === userId);
    return Promise.all(
      mine.map(async (alert) => {
        const product = store.products.find((p) => p.id === alert.productId);
        const view = publicAlert(alert, product);
        if (view.dropped && !alert.notified) {
          alert.notified = true;
          alert.notifiedAt = new Date().toISOString();
          store.notifications.unshift({
            id: createId(),
            userId,
            type: 'PRICE_DROP',
            productId: alert.productId,
            message: `${product?.name || 'Product'} demo price dropped to $${view.currentPrice}`,
            read: false,
            createdAt: new Date().toISOString(),
          });
        }
        return view;
      })
    );
  }

  const rows = await prisma.priceAlert.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => publicAlert(row, row.product));
}

export async function subscribePriceAlert(userId, productId, targetPrice = null) {
  const product = await getProductById(productId);
  if (!product) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  if (config.demoMode) {
    const store = await getDemoStore();
    const existing = store.priceAlerts.find(
      (a) => a.userId === userId && a.productId === productId
    );
    if (existing) {
      const err = new Error('You already have a price drop alert for this product');
      err.status = 409;
      throw err;
    }
    const alert = {
      id: createId(),
      userId,
      productId,
      subscribedPrice: Number(product.price),
      targetPrice: targetPrice != null ? Number(targetPrice) : null,
      notified: false,
      notifiedAt: null,
      createdAt: new Date().toISOString(),
    };
    store.priceAlerts.unshift(alert);
    return publicAlert(alert, product);
  }

  try {
    const alert = await prisma.priceAlert.create({
      data: {
        userId,
        productId,
        subscribedPrice: Number(product.price),
        targetPrice: targetPrice != null ? Number(targetPrice) : null,
      },
      include: { product: true },
    });
    return publicAlert(alert, alert.product);
  } catch (e) {
    if (e.code === 'P2002') {
      const err = new Error('You already have a price drop alert for this product');
      err.status = 409;
      throw err;
    }
    throw e;
  }
}

export async function unsubscribePriceAlert(userId, alertId) {
  if (config.demoMode) {
    const store = await getDemoStore();
    const idx = store.priceAlerts.findIndex((a) => a.id === alertId && a.userId === userId);
    if (idx === -1) {
      const err = new Error('Alert not found');
      err.status = 404;
      throw err;
    }
    store.priceAlerts.splice(idx, 1);
    return { removed: true };
  }

  const existing = await prisma.priceAlert.findFirst({ where: { id: alertId, userId } });
  if (!existing) {
    const err = new Error('Alert not found');
    err.status = 404;
    throw err;
  }
  await prisma.priceAlert.delete({ where: { id: alertId } });
  return { removed: true };
}

export async function getPriceHistory(productId) {
  if (config.demoMode) {
    const store = await getDemoStore();
    return store.priceHistory
      .filter((h) => h.productId === productId)
      .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
  }
  return prisma.priceHistory.findMany({
    where: { productId },
    orderBy: { recordedAt: 'asc' },
  });
}

export async function listNotifications(userId) {
  if (config.demoMode) {
    const store = await getDemoStore();
    return store.notifications.filter((n) => n.userId === userId);
  }
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

/** Demo helper: reduce product price so subscribed alerts can fire. */
export async function simulateDemoPriceDrop(productId, percent = 8) {
  const product = await getProductById(productId);
  if (!product) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  const pct = Math.min(30, Math.max(1, Number(percent) || 8));
  const next = Math.round(Number(product.price) * (1 - pct / 100) * 100) / 100;

  if (config.demoMode) {
    const store = await getDemoStore();
    const target = store.products.find((p) => p.id === productId);
    if (!target) {
      const err = new Error('Product not found');
      err.status = 404;
      throw err;
    }
    store.priceHistory.push({
      id: createId(),
      productId,
      price: Number(target.price),
      recordedAt: new Date().toISOString(),
    });
    target.price = next;
    target.updatedAt = new Date().toISOString();
    store.priceHistory.push({
      id: createId(),
      productId,
      price: next,
      recordedAt: new Date().toISOString(),
    });
    return { productId, previousPrice: product.price, price: next, demo: true };
  }

  await prisma.priceHistory.create({
    data: { productId, price: Number(product.price) },
  });
  const updated = await prisma.product.update({
    where: { id: productId },
    data: { price: next },
  });
  await prisma.priceHistory.create({
    data: { productId, price: next },
  });
  return { productId, previousPrice: product.price, price: updated.price, demo: true };
}

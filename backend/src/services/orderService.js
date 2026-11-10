import { listUsers } from './userService.js';
import { config } from '../config.js';
import { prisma } from '../db/prisma.js';
import { createId, getDemoStore } from '../db/demoStore.js';
import { getProductById } from './productService.js';
import { getUnitPrice } from '../utils/pricing.js';
import { clearCart } from './cartService.js';
import {
  assertPromoUsable,
  computeDiscount,
  getPromoByCode,
  normalizeCode,
} from './promoService.js';
import { createNotification } from './notificationService.js';

const ORDER_INCLUDE = {
  items: { include: { product: true } },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  user: { select: { id: true, name: true, email: true } },
};

function buildOrderNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VOL-${stamp}-${suffix}`;
}

function estimatedDeliveryFrom(status, now = new Date()) {
  const days = status === 'SHIPPED' ? 3 : status === 'PROCESSING' ? 5 : 7;
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date;
}

function buildTrackingNumber() {
  return `VQ${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function createOrder(userId, payload) {
  const { items, shipping } = payload;

  if (!items?.length) {
    const err = new Error('Cart is empty');
    err.status = 400;
    throw err;
  }

  const lineItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = await getProductById(item.productId);
    if (!product) {
      const err = new Error(`Product not found: ${item.productId}`);
      err.status = 404;
      throw err;
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || product.stock < quantity) {
      const err = new Error(`Insufficient stock for ${product.name}`);
      err.status = 400;
      throw err;
    }

    const optionKeys = Array.isArray(product.options)
      ? product.options.map((o) => o.key)
      : ['color', 'storage', 'ram', 'size', 'chip', 'connectivity', 'material', 'band', 'model', 'case', 'compatible'];
    const declared = Array.isArray(product.options) ? product.options : [];
    const selections = Object.create(null);
    for (const key of optionKeys) {
      if (item[key] != null && item[key] !== '') selections[key] = item[key];
    }
    if (item.configuration && typeof item.configuration === 'object') {
      Object.assign(selections, item.configuration);
    }
    if (declared.length) {
      for (const key of Object.keys(selections)) {
        if (!optionKeys.includes(key)) throw Object.assign(new Error('Unknown configuration option'), { status: 400 });
      }
      for (const { key, values } of declared) {
        selections[key] ??= values[0];
        if (!values.includes(selections[key])) {
          throw Object.assign(new Error('Unsupported ' + key + ' option for ' + product.name), { status: 400 });
        }
      }
    }
    const unitPrice = getUnitPrice(product, selections);
    const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
    subtotal += lineTotal;
    lineItems.push({
      productId: product.id,
      quantity,
      price: unitPrice,
      color: selections.color || null,
      storage: selections.storage || null,
      ram: selections.ram || null,
      size: selections.size || null,
      configuration: selections,
      product,
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;
  let discountAmount = 0;
  let promo = null;
  const promoCodeRaw = payload.promoCode ? normalizeCode(payload.promoCode) : '';

  if (promoCodeRaw) {
    promo = await getPromoByCode(promoCodeRaw);
    await assertPromoUsable(promo, userId);
    discountAmount = computeDiscount(promo, lineItems, subtotal);
  }

  const total = Math.round(Math.max(0, subtotal - discountAmount) * 100) / 100;

  if (payload.expectedTotal != null && Math.round(total * 100) !== Math.round(payload.expectedTotal * 100)) {
    const err = new Error('The order total changed. Review your selection and promo before purchasing.');
    err.status = 409;
    throw err;
  }

  const orderNumber = buildOrderNumber();
  const estimatedDelivery = estimatedDeliveryFrom('PENDING');

  if (config.demoMode) {
    const store = await getDemoStore();
    const order = {
      id: createId(),
      orderNumber,
      userId,
      status: 'PENDING',
      subtotal,
      discountAmount,
      total,
      promoCodeId: promo?.id || null,
      promoCodeSnapshot: promo?.code || null,
      trackingNumber: null,
      estimatedDelivery: estimatedDelivery.toISOString(),
      trackingDemoNote: 'Simulated tracking for the VOLTENIQ demo store — no real shipment.',
      shippingName: shipping.name,
      shippingAddress: shipping.address,
      shippingCity: shipping.city,
      shippingZip: shipping.zip,
      shippingCountry: shipping.country || 'Demo Country',
      demoNote: 'DEMO ORDER — no real payment processed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusHistory: [
        {
          id: createId(),
          status: 'PENDING',
          note: 'Demo order placed',
          createdAt: new Date().toISOString(),
        },
      ],
      items: lineItems.map((li) => ({
        id: createId(),
        productId: li.productId,
        quantity: li.quantity,
        price: li.price,
        color: li.color,
        storage: li.storage,
        ram: li.ram,
        size: li.size,
        configuration: li.configuration,
        product: li.product,
      })),
    };

    for (const li of lineItems) {
      const product = store.products.find((p) => p.id === li.productId);
      if (product) product.stock -= li.quantity;
    }

    store.orders.unshift(order);
    await clearCart(userId).catch(() => {});
    return order;
  }

  const order = await prisma.$transaction(async (tx) => {
    for (const item of lineItems) {
      const updated = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (!updated.count) {
        const err = new Error(`Insufficient stock for ${item.product.name}`);
        err.status = 409;
        throw err;
      }
    }

    if (promo) {
      const bumped = await tx.promoCode.updateMany({
        where: {
          id: promo.id,
          active: true,
          OR: [{ maxUses: null }, { usedCount: { lt: promo.maxUses } }],
        },
        data: { usedCount: { increment: 1 } },
      });
      if (!bumped.count) {
        const err = new Error('Promo code usage limit reached.');
        err.status = 400;
        throw err;
      }
    }

    const created = await tx.order.create({
      data: {
        userId,
        orderNumber,
        subtotal,
        discountAmount,
        total,
        promoCodeId: promo?.id || null,
        promoCodeSnapshot: promo?.code || null,
        estimatedDelivery,
        shippingName: shipping.name,
        shippingAddress: shipping.address,
        shippingCity: shipping.city,
        shippingZip: shipping.zip,
        shippingCountry: shipping.country || 'Demo Country',
        items: {
          create: lineItems.map((li) => ({
            productId: li.productId,
            quantity: li.quantity,
            price: li.price,
            color: li.color,
            storage: li.storage,
            ram: li.ram,
            size: li.size,
            configuration: { ...li.configuration },
          })),
        },
        statusHistory: {
          create: {
            status: 'PENDING',
            note: 'Demo order placed',
            createdBy: userId,
          },
        },
      },
      include: ORDER_INCLUDE,
    });

    if (promo) {
      await tx.promoRedemption.create({
        data: {
          promoCodeId: promo.id,
          userId,
          orderId: created.id,
          amount: discountAmount,
        },
      });
    }

    return created;
  });

  await clearCart(userId).catch(() => {});
  await createNotification({
    userId,
    type: 'order_status',
    orderId: order.id,
    message: `Order ${order.orderNumber || order.id} is Pending. Simulated tracking is available in your account.`,
  }).catch(() => {});

  return order;
}

export async function getOrdersByUser(userId) {
  if (config.demoMode) {
    const store = await getDemoStore();
    return store.orders.filter((o) => o.userId === userId);
  }
  return prisma.order.findMany({
    where: { userId },
    include: {
      items: { include: { product: true } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getOrderById(id, userId, isAdmin = false) {
  if (config.demoMode) {
    const store = await getDemoStore();
    const order = store.orders.find((o) => o.id === id);
    if (!order) return null;
    if (!isAdmin && order.userId !== userId) return null;
    return order;
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: ORDER_INCLUDE,
  });
  if (!order) return null;
  if (!isAdmin && order.userId !== userId) return null;
  return order;
}

export async function listAllOrders() {
  if (config.demoMode) {
    const store = await getDemoStore();
    const users = new Map((await listUsers()).map((user) => [user.id, user]));
    return store.orders.map((order) => {
      const user = users.get(order.userId);
      return {
        ...order,
        user: user ? { id: user.id, name: user.name, email: user.email } : null,
      };
    });
  }
  return prisma.order.findMany({
    include: ORDER_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateOrderTracking(id, { status, trackingNumber, estimatedDelivery, note, adminId }) {
  const allowed = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  const existing = config.demoMode
    ? (await getDemoStore()).orders.find((o) => o.id === id)
    : await prisma.order.findUnique({ where: { id } });
  if (!existing) return null;

  const nextStatus = status || existing.status;
  if (!allowed.includes(nextStatus)) {
    const err = new Error('Invalid order status');
    err.status = 400;
    throw err;
  }

  let nextTracking = trackingNumber !== undefined ? trackingNumber : existing.trackingNumber;
  if (['SHIPPED', 'DELIVERED'].includes(nextStatus) && !nextTracking) {
    nextTracking = buildTrackingNumber();
  }

  let nextEta = estimatedDelivery !== undefined
    ? (estimatedDelivery ? new Date(estimatedDelivery) : null)
    : existing.estimatedDelivery;
  if (!nextEta && nextStatus !== 'CANCELLED' && nextStatus !== 'DELIVERED') {
    nextEta = estimatedDeliveryFrom(nextStatus);
  }

  const historyNote =
    note
    || (status && status !== existing.status
      ? `Status updated to ${nextStatus} (simulated tracking)`
      : 'Tracking details updated (simulated)');

  if (config.demoMode) {
    existing.status = nextStatus;
    existing.trackingNumber = nextTracking;
    existing.estimatedDelivery = nextEta ? new Date(nextEta).toISOString() : null;
    existing.updatedAt = new Date().toISOString();
    existing.statusHistory = existing.statusHistory || [];
    existing.statusHistory.push({
      id: createId(),
      status: nextStatus,
      note: historyNote,
      createdAt: new Date().toISOString(),
      createdBy: adminId || null,
    });
    return existing;
  }

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id },
      data: {
        status: nextStatus,
        trackingNumber: nextTracking || null,
        estimatedDelivery: nextEta,
      },
      include: ORDER_INCLUDE,
    });

    await tx.orderStatusEvent.create({
      data: {
        orderId: id,
        status: nextStatus,
        note: historyNote,
        createdBy: adminId || null,
      },
    });

    return tx.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
  });

  if (status && status !== existing.status) {
    await createNotification({
      userId: order.userId,
      type: 'order_status',
      orderId: order.id,
      message: `Order ${order.orderNumber || order.id} is now ${nextStatus}. Simulated tracking updated.`,
    }).catch(() => {});
  }

  return order;
}

export async function updateOrderStatus(id, status, adminId = null) {
  return updateOrderTracking(id, { status, adminId });
}

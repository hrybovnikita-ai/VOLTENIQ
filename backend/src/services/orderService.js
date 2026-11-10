import { listUsers } from './userService.js';
import { config } from '../config.js';
import { prisma } from '../db/prisma.js';
import { createId, getDemoStore } from '../db/demoStore.js';
import { getProductById } from './productService.js';
import { getUnitPrice } from '../utils/pricing.js';
import { clearCart } from './cartService.js';

function buildOrderNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VOL-${stamp}-${suffix}`;
}

export async function createOrder(userId, payload) {
  const { items, shipping } = payload;

  if (!items?.length) {
    const err = new Error('Cart is empty');
    err.status = 400;
    throw err;
  }

  const lineItems = [];
  let total = 0;

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
    // Server recalculates unit price from variants — never trusts a pre-multiplied total
    const unitPrice = getUnitPrice(product, selections);
    const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
    total += lineTotal;
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

  if (payload.expectedTotal != null && Math.round(total * 100) !== Math.round(payload.expectedTotal * 100)) {
    const err = new Error('The product price changed. Review your selection before purchasing.');
    err.status = 409;
    throw err;
  }

  const orderNumber = buildOrderNumber();

  if (config.demoMode) {
    const store = await getDemoStore();
    const order = {
      id: createId(),
      orderNumber,
      userId,
      status: 'PENDING',
      total: Math.round(total * 100) / 100,
      shippingName: shipping.name,
      shippingAddress: shipping.address,
      shippingCity: shipping.city,
      shippingZip: shipping.zip,
      shippingCountry: shipping.country || 'Demo Country',
      demoNote: 'DEMO ORDER — no real payment processed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
    return tx.order.create({
      data: {
        userId,
        orderNumber,
        total: Math.round(total * 100) / 100,
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
      },
      include: {
        items: { include: { product: true } },
      },
    });
  });

  await clearCart(userId).catch(() => {});
  return order;
}

export async function getOrdersByUser(userId) {
  if (config.demoMode) {
    const store = await getDemoStore();
    return store.orders.filter((o) => o.userId === userId);
  }
  return prisma.order.findMany({
    where: { userId },
    include: { items: { include: { product: true } } },
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
    include: { items: { include: { product: true } }, user: { select: { id: true, name: true, email: true } } },
  });
  if (!order) return null;
  if (!isAdmin && order.userId !== userId) return null;
  return order;
}

export async function listAllOrders() {
  if (config.demoMode) {
    const store = await getDemoStore();
    const users = new Map((await listUsers()).map(user => [user.id, user]));
    return store.orders.map((order) => {
      const user = users.get(order.userId);
      return {
        ...order,
        user: user ? { id: user.id, name: user.name, email: user.email } : null,
      };
    });
  }
  return prisma.order.findMany({
    include: {
      items: { include: { product: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateOrderStatus(id, status) {
  const allowed = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  if (!allowed.includes(status)) {
    const err = new Error('Invalid order status');
    err.status = 400;
    throw err;
  }

  if (config.demoMode) {
    const store = await getDemoStore();
    const order = store.orders.find((o) => o.id === id);
    if (!order) return null;
    order.status = status;
    order.updatedAt = new Date().toISOString();
    return order;
  }

  return prisma.order.update({
    where: { id },
    data: { status },
    include: { items: { include: { product: true } }, user: { select: { id: true, name: true, email: true } } },
  });
}

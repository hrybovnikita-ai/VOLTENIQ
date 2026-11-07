import { config } from '../config.js';
import { prisma } from '../db/prisma.js';
import { createId, getDemoStore } from '../db/demoStore.js';
import { getProductById } from './productService.js';
import { clampQuantity, getUnitPrice } from '../utils/pricing.js';

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

    const quantity = clampQuantity(item.quantity, product.stock);
    if (quantity < 1 || product.stock < quantity) {
      const err = new Error(`Insufficient stock for ${product.name}`);
      err.status = 400;
      throw err;
    }

    const optionKeys = Array.isArray(product.options)
      ? product.options.map((o) => o.key)
      : ['color', 'storage', 'ram', 'size', 'chip', 'connectivity', 'material', 'band', 'model', 'case', 'compatible'];
    const selections = {};
    for (const key of optionKeys) {
      if (item[key] != null && item[key] !== '') selections[key] = item[key];
    }
    if (item.configuration && typeof item.configuration === 'object') {
      Object.assign(selections, item.configuration);
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

  if (config.demoMode) {
    const store = await getDemoStore();
    const order = {
      id: createId(),
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
    return order;
  }

  const order = await prisma.order.create({
    data: {
      userId,
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
        })),
      },
    },
    include: {
      items: { include: { product: true } },
    },
  });

  for (const li of lineItems) {
    await prisma.product.update({
      where: { id: li.productId },
      data: { stock: { decrement: li.quantity } },
    });
  }

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
    return store.orders.map((order) => {
      const user = store.users.find((u) => u.id === order.userId);
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

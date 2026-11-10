import { prisma } from '../db/prisma.js';
import { getProductsByIds } from './productService.js';
import { getUnitPrice } from '../utils/pricing.js';

export const VARIANT_KEYS = [
  'color',
  'storage',
  'ram',
  'size',
  'chip',
  'connectivity',
  'material',
  'band',
  'model',
  'case',
  'compatible',
];

export function isValidCartItem(item) {
  return (
    item
    && typeof item.productId === 'string'
    && item.productId.length > 0
    && item.productId.length <= 100
    && Number.isInteger(item.quantity)
    && item.quantity >= 1
    && item.quantity <= 999
    && item.selection
    && typeof item.selection === 'object'
    && !Array.isArray(item.selection)
    && Object.entries(item.selection).every(
      ([key, value]) =>
        VARIANT_KEYS.includes(key)
        && typeof value === 'string'
        && value.length > 0
        && value.length <= 120
    )
    && Object.keys(item).every((key) => ['productId', 'quantity', 'selection'].includes(key))
  );
}

async function withProductSnapshots(items) {
  const list = Array.isArray(items) ? items : [];
  const ids = [...new Set(list.map((item) => item.productId))];
  const products = ids.length ? await getProductsByIds(ids) : [];
  const byId = Object.fromEntries(products.map((product) => [product.id, product]));
  return list.map((item) => {
    const product = byId[item.productId];
    const unitPrice = product ? getUnitPrice(product, item.selection || {}) : 0;
    return {
      ...item,
      unitPrice,
      product: product
        ? {
            id: product.id,
            name: product.name,
            image: product.image,
            stock: product.stock,
            price: product.price,
            variantPricing: product.variantPricing,
            variantImages: product.variantImages,
            colorImages: product.colorImages,
            options: product.options,
          }
        : null,
    };
  });
}

export async function getCart(userId) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  const items = Array.isArray(cart?.items) ? cart.items : [];
  return {
    version: cart?.version ?? 0,
    items: await withProductSnapshots(items),
  };
}

export async function saveCart(userId, { items, version }) {
  if (!Array.isArray(items) || items.length > 100 || !items.every(isValidCartItem)) {
    const err = new Error('Invalid cart items.');
    err.status = 400;
    throw err;
  }
  if (!Number.isSafeInteger(version) || version < 0) {
    const err = new Error('Invalid cart version.');
    err.status = 400;
    throw err;
  }

  const ids = [...new Set(items.map((item) => item.productId))];
  if (ids.length) {
    const products = await getProductsByIds(ids);
    if (products.length !== ids.length) {
      const err = new Error('A product is no longer available.');
      err.status = 400;
      throw err;
    }
    for (const item of items) {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product || product.stock < item.quantity) {
        const err = new Error(`Insufficient stock for ${product?.name || 'a product'}.`);
        err.status = 400;
        throw err;
      }
    }
  }

  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (!existing) {
    if (version !== 0) {
      const err = new Error('Cart changed. Reload the saved cart and retry.');
      err.status = 409;
      throw err;
    }
    const created = await prisma.cart.create({
      data: {
        userId,
        version: 1,
        items,
      },
    });
    return {
      version: created.version,
      items: await withProductSnapshots(created.items),
    };
  }

  if (existing.version !== version) {
    const err = new Error('Cart changed. Reload the saved cart and retry.');
    err.status = 409;
    throw err;
  }

  const updated = await prisma.cart.update({
    where: { userId },
    data: {
      items,
      version: { increment: 1 },
    },
  });
  return {
    version: updated.version,
    items: await withProductSnapshots(updated.items),
  };
}

export async function clearCart(userId) {
  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (!existing) return { version: 0, items: [] };
  const updated = await prisma.cart.update({
    where: { userId },
    data: { items: [], version: { increment: 1 } },
  });
  return { version: updated.version, items: [] };
}

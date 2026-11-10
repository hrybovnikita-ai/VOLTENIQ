import { prisma } from '../db/prisma.js';

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function sanitizePromo(promo) {
  if (!promo) return null;
  return {
    id: promo.id,
    code: promo.code,
    description: promo.description,
    type: promo.type,
    value: promo.value,
    minOrderAmount: promo.minOrderAmount,
    maxUses: promo.maxUses,
    usedCount: promo.usedCount,
    perUserLimit: promo.perUserLimit,
    startsAt: promo.startsAt,
    expiresAt: promo.expiresAt,
    active: promo.active,
    productIds: promo.productIds || [],
    createdAt: promo.createdAt,
    updatedAt: promo.updatedAt,
  };
}

function eligibleSubtotal(lineItems, productIds = []) {
  if (!productIds?.length) {
    return lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
  const allowed = new Set(productIds);
  return lineItems
    .filter((item) => allowed.has(item.productId))
    .reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function computeDiscount(promo, lineItems, orderSubtotal) {
  const eligible = eligibleSubtotal(lineItems, promo.productIds);
  if (eligible <= 0) {
    const err = new Error('This promo does not apply to the products in your bag.');
    err.status = 400;
    throw err;
  }
  if (orderSubtotal < Number(promo.minOrderAmount || 0)) {
    const err = new Error(`Minimum order amount is $${Number(promo.minOrderAmount).toFixed(2)}.`);
    err.status = 400;
    throw err;
  }

  let amount = 0;
  if (promo.type === 'PERCENTAGE') {
    amount = eligible * (Number(promo.value) / 100);
  } else {
    amount = Number(promo.value);
  }
  amount = Math.min(amount, eligible, orderSubtotal);
  return Math.round(Math.max(0, amount) * 100) / 100;
}

async function assertPromoUsable(promo, userId) {
  if (!promo || !promo.active) {
    const err = new Error('Promo code is not available.');
    err.status = 400;
    throw err;
  }
  const now = new Date();
  if (promo.startsAt && promo.startsAt > now) {
    const err = new Error('Promo code is not active yet.');
    err.status = 400;
    throw err;
  }
  if (promo.expiresAt && promo.expiresAt < now) {
    const err = new Error('Promo code has expired.');
    err.status = 400;
    throw err;
  }
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    const err = new Error('Promo code usage limit reached.');
    err.status = 400;
    throw err;
  }
  if (userId && promo.perUserLimit > 0) {
    const used = await prisma.promoRedemption.count({
      where: { promoCodeId: promo.id, userId },
    });
    if (used >= promo.perUserLimit) {
      const err = new Error('You have already used this promo code.');
      err.status = 400;
      throw err;
    }
  }
}

export async function validatePromoForCart(userId, code, lineItems) {
  const normalized = normalizeCode(code);
  if (!normalized) {
    const err = new Error('Enter a promo code.');
    err.status = 400;
    throw err;
  }
  const promo = await prisma.promoCode.findUnique({ where: { code: normalized } });
  await assertPromoUsable(promo, userId);
  const subtotal = lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = computeDiscount(promo, lineItems, subtotal);
  const total = Math.round(Math.max(0, subtotal - discountAmount) * 100) / 100;
  return {
    promo: sanitizePromo(promo),
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount,
    total,
  };
}

export async function listPromos() {
  const rows = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(sanitizePromo);
}

export async function createPromo(data) {
  const code = normalizeCode(data.code);
  if (!code || code.length > 32) {
    const err = new Error('Promo code must be 1–32 characters.');
    err.status = 400;
    throw err;
  }
  if (!['PERCENTAGE', 'FIXED'].includes(data.type)) {
    const err = new Error('Discount type must be PERCENTAGE or FIXED.');
    err.status = 400;
    throw err;
  }
  const value = Number(data.value);
  if (!Number.isFinite(value) || value <= 0) {
    const err = new Error('Discount value must be greater than zero.');
    err.status = 400;
    throw err;
  }
  if (data.type === 'PERCENTAGE' && value > 100) {
    const err = new Error('Percentage discount cannot exceed 100.');
    err.status = 400;
    throw err;
  }

  try {
    const promo = await prisma.promoCode.create({
      data: {
        code,
        description: data.description ? String(data.description).slice(0, 240) : null,
        type: data.type,
        value,
        minOrderAmount: Math.max(0, Number(data.minOrderAmount) || 0),
        maxUses: data.maxUses == null || data.maxUses === '' ? null : Math.max(1, Number(data.maxUses)),
        perUserLimit: Math.max(0, Number(data.perUserLimit) || 1),
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        active: data.active !== false,
        productIds: Array.isArray(data.productIds) ? data.productIds.filter(Boolean) : [],
      },
    });
    return sanitizePromo(promo);
  } catch (error) {
    if (error.code === 'P2002') {
      const err = new Error('That promo code already exists.');
      err.status = 409;
      throw err;
    }
    throw error;
  }
}

export async function updatePromo(id, data) {
  const existing = await prisma.promoCode.findUnique({ where: { id } });
  if (!existing) return null;
  const patch = {};
  if (data.description !== undefined) {
    patch.description = data.description ? String(data.description).slice(0, 240) : null;
  }
  if (data.type !== undefined) {
    if (!['PERCENTAGE', 'FIXED'].includes(data.type)) {
      const err = new Error('Discount type must be PERCENTAGE or FIXED.');
      err.status = 400;
      throw err;
    }
    patch.type = data.type;
  }
  if (data.value !== undefined) {
    const value = Number(data.value);
    if (!Number.isFinite(value) || value <= 0) {
      const err = new Error('Discount value must be greater than zero.');
      err.status = 400;
      throw err;
    }
    patch.value = value;
  }
  if (data.minOrderAmount !== undefined) patch.minOrderAmount = Math.max(0, Number(data.minOrderAmount) || 0);
  if (data.maxUses !== undefined) {
    patch.maxUses = data.maxUses == null || data.maxUses === '' ? null : Math.max(1, Number(data.maxUses));
  }
  if (data.perUserLimit !== undefined) patch.perUserLimit = Math.max(0, Number(data.perUserLimit) || 0);
  if (data.startsAt !== undefined) patch.startsAt = data.startsAt ? new Date(data.startsAt) : null;
  if (data.expiresAt !== undefined) patch.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  if (data.active !== undefined) patch.active = Boolean(data.active);
  if (data.productIds !== undefined) {
    patch.productIds = Array.isArray(data.productIds) ? data.productIds.filter(Boolean) : [];
  }
  const promo = await prisma.promoCode.update({ where: { id }, data: patch });
  return sanitizePromo(promo);
}

export async function deletePromo(id) {
  try {
    await prisma.promoCode.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function getPromoByCode(code) {
  return prisma.promoCode.findUnique({ where: { code: normalizeCode(code) } });
}

export { sanitizePromo, normalizeCode, assertPromoUsable };

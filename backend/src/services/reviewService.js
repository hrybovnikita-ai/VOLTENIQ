import { prisma } from '../db/prisma.js';

const PHOTO_MAX = 3;
const PHOTO_MAX_LEN = 180_000;
const BODY_MAX = 2000;
const TITLE_MAX = 120;

export function isAllowedPhoto(value) {
  if (typeof value !== 'string' || !value || value.length > PHOTO_MAX_LEN) return false;
  if (/^https:\/\/.+/i.test(value) && value.length <= 2048) return true;
  return /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(value);
}

function sanitizeReview(review) {
  if (!review) return null;
  return {
    id: review.id,
    productId: review.productId,
    userId: review.userId,
    rating: review.rating,
    title: review.title,
    body: review.body,
    photos: review.photos || [],
    verified: review.verified,
    status: review.status,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    user: review.user
      ? {
          id: review.user.id,
          name: review.user.name,
          avatarUrl: review.user.avatarUrl || null,
        }
      : undefined,
  };
}

async function userPurchasedProduct(userId, productId) {
  const match = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: {
        userId,
        status: 'DELIVERED',
      },
    },
    select: { id: true },
  });
  return Boolean(match);
}

async function refreshProductRating(productId) {
  const approved = await prisma.review.findMany({
    where: { productId, status: 'APPROVED' },
    select: { rating: true },
  });
  const reviewCount = approved.length;
  const rating = reviewCount
    ? Math.round((approved.reduce((sum, row) => sum + row.rating, 0) / reviewCount) * 10) / 10
    : 0;
  await prisma.product.update({
    where: { id: productId },
    data: { rating, reviewCount },
  });
  return { rating, reviewCount };
}

function validatePayload(data, { partial = false } = {}) {
  const next = {};
  if (!partial || data.rating !== undefined) {
    const rating = Number(data.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      const err = new Error('Rating must be an integer from 1 to 5.');
      err.status = 400;
      throw err;
    }
    next.rating = rating;
  }
  if (!partial || data.body !== undefined) {
    const body = String(data.body || '').trim();
    if (body.length < 10 || body.length > BODY_MAX) {
      const err = new Error(`Review text must be between 10 and ${BODY_MAX} characters.`);
      err.status = 400;
      throw err;
    }
    next.body = body;
  }
  if (!partial || data.title !== undefined) {
    const title = data.title == null || data.title === '' ? null : String(data.title).trim();
    if (title && title.length > TITLE_MAX) {
      const err = new Error(`Title must be at most ${TITLE_MAX} characters.`);
      err.status = 400;
      throw err;
    }
    next.title = title;
  }
  if (!partial || data.photos !== undefined) {
    const photos = Array.isArray(data.photos) ? data.photos : [];
    if (photos.length > PHOTO_MAX || !photos.every(isAllowedPhoto)) {
      const err = new Error(`Provide up to ${PHOTO_MAX} HTTPS or image data URLs.`);
      err.status = 400;
      throw err;
    }
    next.photos = photos;
  }
  return next;
}

export async function getReviewSummary(productId) {
  const approved = await prisma.review.findMany({
    where: { productId, status: 'APPROVED' },
    select: { rating: true },
  });
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of approved) distribution[row.rating] += 1;
  const reviewCount = approved.length;
  const average = reviewCount
    ? Math.round((approved.reduce((sum, row) => sum + row.rating, 0) / reviewCount) * 10) / 10
    : 0;
  return { average, reviewCount, distribution };
}

export async function listReviews(productId, { sort = 'newest', page = 1, limit = 8, userId = null } = {}) {
  const take = Math.min(Math.max(Number(limit) || 8, 1), 30);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
  const orderBy =
    sort === 'highest'
      ? [{ rating: 'desc' }, { createdAt: 'desc' }]
      : sort === 'lowest'
        ? [{ rating: 'asc' }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }];

  const where = { productId, status: 'APPROVED' };
  const [rows, total, summary, mine] = await Promise.all([
    prisma.review.findMany({
      where,
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy,
      skip,
      take,
    }),
    prisma.review.count({ where }),
    getReviewSummary(productId),
    userId
      ? prisma.review.findFirst({
          where: { productId, userId },
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        })
      : null,
  ]);

  return {
    reviews: rows.map(sanitizeReview),
    total,
    page: Math.max(Number(page) || 1, 1),
    limit: take,
    summary,
    mine: mine ? sanitizeReview(mine) : null,
  };
}

export async function createReview(userId, productId, data) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const payload = validatePayload(data);
  const verified = await userPurchasedProduct(userId, productId);

  try {
    const review = await prisma.review.create({
      data: {
        userId,
        productId,
        ...payload,
        verified,
        status: 'APPROVED',
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    await refreshProductRating(productId);
    return sanitizeReview(review);
  } catch (error) {
    if (error.code === 'P2002') {
      const err = new Error('You already reviewed this product. Edit your existing review instead.');
      err.status = 409;
      throw err;
    }
    throw error;
  }
}

export async function updateReview(userId, reviewId, data, { isAdmin = false } = {}) {
  const existing = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!existing) return null;
  if (!isAdmin && existing.userId !== userId) {
    const err = new Error('You can only edit your own reviews.');
    err.status = 403;
    throw err;
  }

  const payload = validatePayload(data, { partial: true });
  if (!isAdmin) {
    payload.verified = await userPurchasedProduct(userId, existing.productId);
  }

  const review = await prisma.review.update({
    where: { id: reviewId },
    data: payload,
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  await refreshProductRating(existing.productId);
  return sanitizeReview(review);
}

export async function deleteReview(userId, reviewId, { isAdmin = false } = {}) {
  const existing = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!existing) return false;
  if (!isAdmin && existing.userId !== userId) {
    const err = new Error('You can only delete your own reviews.');
    err.status = 403;
    throw err;
  }
  await prisma.review.delete({ where: { id: reviewId } });
  await refreshProductRating(existing.productId);
  return true;
}

export async function listAllReviews({ status, page = 1, limit = 20 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
  const where = status ? { status } : {};
  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        product: { select: { id: true, name: true, slug: true, image: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.review.count({ where }),
  ]);
  return { reviews: rows, total, page: Math.max(Number(page) || 1, 1), limit: take };
}

export async function moderateReview(reviewId, status) {
  const allowed = ['PENDING', 'APPROVED', 'REJECTED'];
  if (!allowed.includes(status)) {
    const err = new Error('Invalid review status.');
    err.status = 400;
    throw err;
  }
  const existing = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!existing) return null;
  const review = await prisma.review.update({
    where: { id: reviewId },
    data: { status },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      product: { select: { id: true, name: true, slug: true, image: true } },
    },
  });
  await refreshProductRating(existing.productId);
  return review;
}

import { config } from '../config.js';
import { prisma } from '../db/prisma.js';
import { createId, getDemoStore } from '../db/demoStore.js';

export async function listFavorites(userId) {
  if (config.demoMode) {
    const store = await getDemoStore();
    return store.favorites
      .filter((f) => f.userId === userId)
      .map((f) => {
        const product = store.products.find((p) => p.id === f.productId);
        return { ...f, product };
      })
      .filter((f) => f.product);
  }

  return prisma.favorite.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
  });
}

function missingProduct() {
  return Object.assign(new Error('Product not found'), { status: 404 });
}

export async function toggleFavorite(userId, productId) {
  if (config.demoMode) {
    const store = await getDemoStore();
    if (!store.products.some(product => product.id === productId)) throw missingProduct();
    const existing = store.favorites.find(
      (f) => f.userId === userId && f.productId === productId
    );
    if (existing) {
      store.favorites = store.favorites.filter((f) => f.id !== existing.id);
      return { favorited: false };
    }
    store.favorites.push({
      id: createId(),
      userId,
      productId,
      createdAt: new Date().toISOString(),
    });
    return { favorited: true };
  }

  const existing = await prisma.favorite.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  if (existing) {
    await prisma.favorite.deleteMany({ where: { id: existing.id, userId } });
    return { favorited: false };
  }

  try {
    await prisma.favorite.create({ data: { userId, productId } });
  } catch (error) {
    if (error.code === 'P2003') throw missingProduct();
    if (error.code !== 'P2002') throw error;
  }
  return { favorited: true };
}

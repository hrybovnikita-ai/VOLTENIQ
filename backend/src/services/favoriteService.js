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

export async function toggleFavorite(userId, productId) {
  if (config.demoMode) {
    const store = await getDemoStore();
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
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { favorited: false };
  }

  await prisma.favorite.create({ data: { userId, productId } });
  return { favorited: true };
}

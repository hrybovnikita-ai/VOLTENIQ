import { prisma } from '../db/prisma.js';

export async function createNotification({ userId, type, message, productId = null, orderId = null }) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      message,
      productId,
      orderId,
    },
  });
}

export async function listUserNotifications(userId, { take = 50 } = {}) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(Number(take) || 50, 1), 100),
  });
}

export async function markNotificationRead(userId, id) {
  const note = await prisma.notification.findFirst({ where: { id, userId } });
  if (!note) return null;
  return prisma.notification.update({
    where: { id },
    data: { read: true },
  });
}

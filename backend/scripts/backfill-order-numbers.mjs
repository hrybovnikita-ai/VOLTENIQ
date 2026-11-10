import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const orders = await prisma.order.findMany({
  where: { orderNumber: null },
  select: { id: true, createdAt: true },
});

for (const order of orders) {
  const stamp = new Date(order.createdAt).toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = order.id.slice(-4).toUpperCase();
  await prisma.order.update({
    where: { id: order.id },
    data: { orderNumber: `VOL-${stamp}-${suffix}` },
  });
}

console.log(`backfilled ${orders.length} order numbers`);
await prisma.$disconnect();

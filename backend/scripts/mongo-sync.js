import { randomUUID } from 'node:crypto';
import { createMongoClient } from '../src/db/mongo.js';
import { prisma } from '../src/db/prisma.js';
import { categories } from '../src/data/products.js';

let client;
try {
  client = createMongoClient(process.env.MONGODB_SYNC_URI || '');
  await client.connect();
  const db = client.db('volteniq_store');
  await client.withSession(session => session.withTransaction(async () => {
    const generation = randomUUID();
    await db.collection('categories').updateOne({ _id: categories[0].id },
      { $set: { ...categories[0], generation, position: 0 } }, { session, upsert: true });
    const [products, favorites, orders] = await prisma.$transaction([
      prisma.product.findMany(),
      prisma.favorite.findMany({ select: { id: true, userId: true, productId: true } }),
      prisma.order.findMany({ select: { id: true, userId: true, total: true, status: true, createdAt: true,
        items: { select: { productId: true, quantity: true, price: true, color: true, storage: true, ram: true, size: true } } } }),
    ], { isolationLevel: 'RepeatableRead' });
    const data = { products, favorites, demoOrders: orders, categories: categories.map((c, position) => ({ ...c, position })) };
    for (const [name, rows] of Object.entries(data)) {
      const collection = db.collection(name);
      if (rows.length) await collection.bulkWrite(rows.map(row => ({ replaceOne: {
        filter: { _id: row.id }, replacement: { ...row, _id: row.id, generation }, upsert: true,
      } })), { session });
      if (!process.argv.includes('--keep-existing')) {
        await collection.deleteMany({ generation: { $exists: true, $ne: generation } }, { session });
      }
    }
  }));
  console.log('Store snapshot synchronized.');
} catch {
  console.error('Store sync failed. Verify database access, Atlas credentials, and replica-set availability.');
  process.exitCode = 1;
} finally {
  await client?.close();
  await prisma.$disconnect();
}

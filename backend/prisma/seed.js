import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { demoProducts } from '../src/data/products.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding VOLTENIQ database...');

  await prisma.favorite.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  const demoPassword = await bcrypt.hash('password123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);

  await prisma.user.createMany({
    data: [
      {
        name: 'Demo User',
        email: 'demo@volteniq.com',
        password: demoPassword,
        role: 'USER',
      },
      {
        name: 'Volteniq Admin',
        email: 'admin@volteniq.com',
        password: adminPassword,
        role: 'ADMIN',
      },
    ],
  });

  for (const product of demoProducts) {
    await prisma.product.create({ data: product });
  }

  console.log(`Seeded ${demoProducts.length} products and 2 users.`);
  console.log('Demo login: demo@volteniq.com / password123');
  console.log('Admin login: admin@volteniq.com / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

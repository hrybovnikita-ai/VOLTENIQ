import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { demoProducts } from '../src/data/products.js';

const prisma = new PrismaClient();
try {
  const result = await prisma.product.createMany({ data: demoProducts, skipDuplicates: true });
  console.log(`Added ${result.count} catalog products.`);
} finally {
  await prisma.$disconnect();
}

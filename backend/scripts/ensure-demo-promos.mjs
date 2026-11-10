import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const demos = [
  {
    code: 'VOLTENIQ10',
    description: '10% off your demo order',
    type: 'PERCENTAGE',
    value: 10,
    minOrderAmount: 50,
    maxUses: 1000,
    perUserLimit: 5,
  },
  {
    code: 'SAVE25',
    description: '$25 off demo orders over $200',
    type: 'FIXED',
    value: 25,
    minOrderAmount: 200,
    maxUses: 500,
    perUserLimit: 3,
  },
];

for (const promo of demos) {
  await prisma.promoCode.upsert({
    where: { code: promo.code },
    update: {
      description: promo.description,
      type: promo.type,
      value: promo.value,
      minOrderAmount: promo.minOrderAmount,
      maxUses: promo.maxUses,
      perUserLimit: promo.perUserLimit,
      active: true,
    },
    create: promo,
  });
}

console.log(`ensured ${demos.length} demo promo codes`);
await prisma.$disconnect();

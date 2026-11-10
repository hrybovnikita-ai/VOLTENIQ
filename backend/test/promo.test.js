import assert from 'node:assert/strict';
import test from 'node:test';
import { computeDiscount } from '../src/services/promoService.js';

test('percentage and fixed discounts never exceed eligible subtotal', () => {
  const items = [
    { productId: 'a', quantity: 1, price: 100 },
    { productId: 'b', quantity: 2, price: 50 },
  ];
  const percent = computeDiscount(
    { type: 'PERCENTAGE', value: 10, minOrderAmount: 0, productIds: [] },
    items,
    200
  );
  assert.equal(percent, 20);

  const fixed = computeDiscount(
    { type: 'FIXED', value: 250, minOrderAmount: 0, productIds: [] },
    items,
    200
  );
  assert.equal(fixed, 200);
});

test('product-restricted promos only discount matching lines', () => {
  const items = [
    { productId: 'a', quantity: 1, price: 100 },
    { productId: 'b', quantity: 1, price: 80 },
  ];
  const amount = computeDiscount(
    { type: 'FIXED', value: 30, minOrderAmount: 0, productIds: ['a'] },
    items,
    180
  );
  assert.equal(amount, 30);
});

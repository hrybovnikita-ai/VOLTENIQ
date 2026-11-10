import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidCartItem } from '../src/services/cartService.js';

test('isValidCartItem accepts storage variants and quantities', () => {
  assert.equal(
    isValidCartItem({
      productId: 'prod_1',
      quantity: 2,
      selection: { color: 'Black', storage: '256GB' },
    }),
    true
  );
});

test('isValidCartItem rejects client-trusted prices and bad keys', () => {
  assert.equal(
    isValidCartItem({
      productId: 'prod_1',
      quantity: 1,
      selection: { storage: '256GB' },
      price: 1,
    }),
    false
  );
  assert.equal(
    isValidCartItem({
      productId: 'prod_1',
      quantity: 1,
      selection: { unknown: 'x' },
    }),
    false
  );
  assert.equal(
    isValidCartItem({
      productId: 'prod_1',
      quantity: 0,
      selection: {},
    }),
    false
  );
});

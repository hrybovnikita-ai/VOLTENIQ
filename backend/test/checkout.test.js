import test from 'node:test';
import assert from 'node:assert/strict';
import { stripPaymentSecrets } from '../src/utils/paymentSafety.js';
import { createOrder } from '../src/services/orderService.js';
import { config } from '../src/config.js';

function runStrip(body) {
  const req = { body };
  stripPaymentSecrets(req, {}, () => {});
  return req.body;
}

test('stripPaymentSecrets removes card PAN and CVC before order handling', () => {
  const body = runStrip({
    cardNumber: '4242424242424242',
    cvc: '123',
    cvv: '999',
    pan: '5555555555554444',
    paymentMethod: 'Visa',
    payment: { cardNumber: '4242424242424242', cvc: '123' },
    shipping: { name: 'Alex', address: '1 St', city: 'City', zip: '00000' },
    items: [{ productId: 'x', quantity: 1 }],
  });

  assert.equal(body.cardNumber, undefined);
  assert.equal(body.cvc, undefined);
  assert.equal(body.cvv, undefined);
  assert.equal(body.pan, undefined);
  assert.equal(body.payment.cardNumber, undefined);
  assert.equal(body.payment.cvc, undefined);
  assert.equal(body.paymentMethod, 'Visa');
  assert.equal(body.shipping.name, 'Alex');
});

test('stripPaymentSecrets drops unknown paymentMethod values', () => {
  const body = runStrip({ paymentMethod: 'Amex' });
  assert.equal(body.paymentMethod, undefined);
});

test('createOrder persists shipping only — never card fields', async () => {
  const { listProducts } = await import('../src/services/productService.js');
  const { prisma } = await import('../src/db/prisma.js');
  const result = await listProducts({});
  const products = result.products || result;
  const product = Array.isArray(products) ? products[0] : null;
  assert.ok(product, 'catalog should have products');

  let userId = 'demo-user';
  if (!config.demoMode) {
    const user = await prisma.user.findFirst({ select: { id: true } });
    assert.ok(user, 'PostgreSQL needs at least one user for checkout flow test');
    userId = user.id;
  }

  // Mirror what the API does after stripPaymentSecrets
  const inbound = runStrip({
    items: [{ productId: product.id, quantity: 1, configuration: {} }],
    shipping: {
      name: 'Alex Sample',
      address: '42 Sample Street',
      city: 'Test City',
      zip: '00000',
      country: 'Demo Country',
    },
    expectedTotal: product.price,
    cardNumber: '4242424242424242',
    cvc: '123',
    paymentMethod: 'Visa',
  });

  assert.equal(inbound.cardNumber, undefined);
  assert.equal(inbound.cvc, undefined);

  const order = await createOrder(userId, inbound);
  const raw = JSON.stringify(order);

  assert.equal(order.shippingName, 'Alex Sample');
  assert.equal(order.shippingAddress, '42 Sample Street');
  assert.equal(raw.includes('4242424242424242'), false);
  assert.equal(/"cvc"|cardNumber/i.test(raw), false);
  assert.ok(order.id);
  assert.ok(order.items?.length >= 1);

  if (config.demoMode) {
    assert.match(order.demoNote || '', /DEMO ORDER/i);
  } else {
    // Clean up the demo purchase created by this test
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
  }
});

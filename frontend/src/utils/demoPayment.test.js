import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEMO_MASTERCARD_PAN,
  DEMO_VISA_PAN,
  assertNoCardSecrets,
  buildDemoOrderPayload,
  demoDetailsFor,
  digitsOnly,
  formatCardNumber,
  formatCvc,
  formatExpiration,
  validateDemoPayment,
} from './demoPayment.js'

const now = new Date('2026-11-08T12:00:00Z')

test('formats card number into 4-digit groups', () => {
  assert.equal(formatCardNumber('4242424242424242'), '4242 4242 4242 4242')
  assert.equal(formatCardNumber('4242-4242'), '4242 4242')
  assert.equal(digitsOnly(formatCardNumber('5555 5555 5555 4444')), DEMO_MASTERCARD_PAN)
})

test('formats expiration as MM / YY', () => {
  assert.equal(formatExpiration('1239'), '12 / 39')
  assert.equal(formatExpiration('1'), '1')
  assert.equal(formatExpiration('12'), '12')
})

test('formats CVC to digits only', () => {
  assert.equal(formatCvc('12a3'), '123')
  assert.equal(formatCvc('12345'), '1234')
})

test('demo autofill produces valid Visa and Mastercard payloads', () => {
  for (const method of ['Visa', 'Mastercard']) {
    const form = demoDetailsFor(method)
    assert.deepEqual(validateDemoPayment(form, method, now), {})
    assert.equal(digitsOnly(form.cardNumber), method === 'Visa' ? DEMO_VISA_PAN : DEMO_MASTERCARD_PAN)
  }
})

test('rejects empty and non-demo card numbers with clear errors', () => {
  const empty = validateDemoPayment(
    {
      cardNumber: '',
      expiration: '',
      cvc: '',
      cardholderName: '',
      billingAddress: '',
      city: '',
      zip: '',
    },
    'Visa',
    now
  )
  assert.ok(empty.cardNumber)
  assert.ok(empty.expiration)
  assert.ok(empty.cvc)
  assert.ok(empty.cardholderName)
  assert.ok(empty.billingAddress)

  const realLooking = validateDemoPayment(
    {
      ...demoDetailsFor('Visa'),
      cardNumber: formatCardNumber('4111111111111111'),
    },
    'Visa',
    now
  )
  assert.match(realLooking.cardNumber, /4242/)
})

test('wallet methods skip card field validation', () => {
  const form = {
    cardholderName: 'Alex Sample',
    billingAddress: '42 Sample Street',
    city: 'Test City',
    zip: '00000',
    cardNumber: '',
    expiration: '',
    cvc: '',
  }
  assert.deepEqual(validateDemoPayment(form, 'Apple Pay', now), {})
  assert.deepEqual(validateDemoPayment(form, 'Google Pay', now), {})
})

test('order payload never includes card number or CVC', () => {
  const form = demoDetailsFor('Visa')
  const payload = buildDemoOrderPayload({
    items: [{ productId: 'prod_1', quantity: 1, color: 'Midnight' }],
    form,
    method: 'Visa',
    expectedTotal: 999,
    selections: (item) => ({ color: item.color }),
  })

  assert.equal(payload.paymentMethod, 'Visa')
  assert.equal(payload.shipping.name, 'Alex Sample')
  assert.equal(payload.shipping.address, '42 Sample Street')
  assert.equal(Object.hasOwn(payload, 'cardNumber'), false)
  assert.equal(Object.hasOwn(payload, 'cvc'), false)
  assert.equal(assertNoCardSecrets(payload), true)
  assert.equal(JSON.stringify(payload).includes('4242'), false)
  assert.equal(JSON.stringify(payload).includes('123'), false)
})

test('manually entered valid demo Mastercard data validates', () => {
  const form = {
    cardNumber: formatCardNumber(DEMO_MASTERCARD_PAN),
    expiration: formatExpiration('1239'),
    cvc: formatCvc('123'),
    cardholderName: 'Jordan Demo',
    billingAddress: '9 Test Ave',
    city: 'Demo City',
    zip: '12345',
    country: 'Demo Country',
  }
  assert.deepEqual(validateDemoPayment(form, 'Mastercard', now), {})
  assert.equal(
    assertNoCardSecrets(
      buildDemoOrderPayload({
        items: [{ productId: 'x', quantity: 2 }],
        form,
        method: 'Mastercard',
        expectedTotal: 100,
        selections: () => ({}),
      })
    ),
    true
  )
})

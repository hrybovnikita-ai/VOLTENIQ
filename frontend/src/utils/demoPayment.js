/** Demo-only payment helpers. Real card data must never leave the browser. */

export const PAYMENT_METHODS = ['Visa', 'Mastercard', 'Apple Pay', 'Google Pay']

export const DEMO_VISA_PAN = '4242424242424242'
export const DEMO_MASTERCARD_PAN = '5555555555554444'

export const DEMO_BILLING = {
  name: 'Alex Sample',
  address: '42 Sample Street',
  city: 'Test City',
  zip: '00000',
  country: 'Demo Country',
}

export function isCardMethod(method) {
  return method === 'Visa' || method === 'Mastercard'
}

export function digitsOnly(value = '') {
  return String(value).replace(/\D/g, '')
}

/** Format as "4242 4242 4242 4242" (max 16 digits). */
export function formatCardNumber(value) {
  const digits = digitsOnly(value).slice(0, 16)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

/** Format as "MM / YY". */
export function formatExpiration(value) {
  const digits = digitsOnly(value).slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`
}

export function formatCvc(value) {
  return digitsOnly(value).slice(0, 4)
}

export function demoDetailsFor(method) {
  const pan = method === 'Mastercard' ? DEMO_MASTERCARD_PAN : DEMO_VISA_PAN
  return {
    cardNumber: formatCardNumber(pan),
    expiration: '12 / 39',
    cvc: '123',
    cardholderName: DEMO_BILLING.name,
    billingAddress: DEMO_BILLING.address,
    city: DEMO_BILLING.city,
    zip: DEMO_BILLING.zip,
    country: DEMO_BILLING.country,
  }
}

export function emptyPaymentForm() {
  return {
    cardNumber: '',
    expiration: '',
    cvc: '',
    cardholderName: '',
    billingAddress: '',
    city: '',
    zip: '',
    country: DEMO_BILLING.country,
  }
}

function expirationParts(expiration) {
  const digits = digitsOnly(expiration)
  if (digits.length !== 4) return null
  const month = Number(digits.slice(0, 2))
  const year = Number(digits.slice(2, 4))
  if (!Number.isInteger(month) || month < 1 || month > 12) return null
  return { month, year: 2000 + year }
}

function expirationIsFuture(expiration, now = new Date()) {
  const parts = expirationParts(expiration)
  if (!parts) return false
  const expEnd = new Date(parts.year, parts.month, 0, 23, 59, 59, 999)
  return expEnd >= now
}

/**
 * Validate demo checkout form. Returns field error map (empty = valid).
 * Only Stripe-style demo PANs are accepted — never arbitrary/real cards.
 */
export function validateDemoPayment(form, method, now = new Date()) {
  const errors = {}

  if (!form.cardholderName?.trim()) {
    errors.cardholderName = 'Enter the cardholder name.'
  }
  if (!form.billingAddress?.trim()) {
    errors.billingAddress = 'Enter a billing address.'
  }
  if (!form.city?.trim()) {
    errors.city = 'Enter a city.'
  }
  if (!form.zip?.trim()) {
    errors.zip = 'Enter a ZIP / postal code.'
  }

  if (!isCardMethod(method)) {
    return errors
  }

  const pan = digitsOnly(form.cardNumber)
  const expected = method === 'Mastercard' ? DEMO_MASTERCARD_PAN : DEMO_VISA_PAN
  if (pan.length !== 16) {
    errors.cardNumber = 'Enter a 16-digit demo card number.'
  } else if (pan !== expected) {
    errors.cardNumber =
      method === 'Mastercard'
        ? 'Use the Mastercard demo card 5555 5555 5555 4444.'
        : 'Use the Visa demo card 4242 4242 4242 4242.'
  }

  if (!expirationParts(form.expiration)) {
    errors.expiration = 'Enter expiration as MM / YY.'
  } else if (!expirationIsFuture(form.expiration, now)) {
    errors.expiration = 'Expiration date must be in the future.'
  }

  const cvc = digitsOnly(form.cvc)
  if (cvc.length < 3 || cvc.length > 4) {
    errors.cvc = 'Enter a 3 or 4 digit demo CVC.'
  }

  return errors
}

/**
 * Build the order API body. Card number and CVC are never included.
 */
export function buildDemoOrderPayload({ items, form, method, expectedTotal, selections, promoCode }) {
  return {
    items: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      configuration: selections(item),
    })),
    shipping: {
      name: form.cardholderName.trim(),
      address: form.billingAddress.trim(),
      city: form.city.trim(),
      zip: form.zip.trim(),
      country: (form.country || DEMO_BILLING.country).trim(),
    },
    expectedTotal,
    ...(promoCode ? { promoCode } : {}),
    // Demo metadata only — no PAN / CVC
    paymentMethod: method,
  }
}

export function assertNoCardSecrets(payload) {
  const raw = JSON.stringify(payload)
  const banned = [/cardNumber/i, /\bcvc\b/i, /\bcvv\b/i, /4242424242424242/, /5555555555554444/]
  return !banned.some((re) => re.test(raw))
}

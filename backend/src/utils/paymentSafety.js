const BANNED_KEYS = [
  'cardNumber',
  'card_number',
  'number',
  'pan',
  'cvc',
  'cvv',
  'securityCode',
  'card',
  'paymentCard',
];

const ALLOWED_METHODS = new Set(['Visa', 'Mastercard', 'Apple Pay', 'Google Pay']);

/** Never accept or forward card PAN / CVC — demo checkout keeps them client-side only. */
export function stripPaymentSecrets(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of BANNED_KEYS) {
      delete req.body[key];
    }
    if (req.body.payment && typeof req.body.payment === 'object') {
      for (const key of BANNED_KEYS) {
        delete req.body.payment[key];
      }
    }
    if (typeof req.body.paymentMethod === 'string' && !ALLOWED_METHODS.has(req.body.paymentMethod)) {
      delete req.body.paymentMethod;
    }
  }
  next();
}

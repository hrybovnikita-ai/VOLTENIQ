import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CreditCard, ShieldCheck, Tag, Wallet } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { api } from '../api/client'
import { clearPurchaseIntent, loadPurchaseIntent } from '../utils/purchaseIntent'
import { cartSelections as selections, getLineTotal } from '../utils/pricing'
import {
  PAYMENT_METHODS,
  assertNoCardSecrets,
  buildDemoOrderPayload,
  demoDetailsFor,
  emptyPaymentForm,
  formatCardNumber,
  formatCvc,
  formatExpiration,
  isCardMethod,
  validateDemoPayment,
} from '../utils/demoPayment'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import './Checkout.css'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function Field({
  id,
  label,
  value,
  onChange,
  error,
  wide,
  disabled,
  inputMode,
  autoComplete,
  maxLength,
  placeholder,
  name,
}) {
  return (
    <label className={`${wide ? 'demo-wide' : ''} ${error ? 'demo-invalid' : ''}`} htmlFor={id}>
      {label}
      <input
        id={id}
        name={name || id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error ? (
        <span id={`${id}-error`} className="demo-field-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  )
}

export default function CheckoutPage() {
  const [intent] = useState(loadPurchaseIntent)
  const { items: cart, clearCart } = useCart()
  const buyNow = intent?.mode === 'buyNow'
  const items = buyNow ? intent.items : cart
  const navigate = useNavigate()
  const [method, setMethod] = useState('Visa')
  const [form, setForm] = useState(emptyPaymentForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [promo, setPromo] = useState(null)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [promoError, setPromoError] = useState('')
  const [promoPending, setPromoPending] = useState(false)
  const submitting = useRef(false)
  const card = isCardMethod(method)
  const subtotal = items.reduce(
    (sum, item) => sum + getLineTotal(item.unitPrice ?? item.price, item.quantity),
    0
  )
  const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100)

  async function applyPromo() {
    setPromoPending(true)
    setPromoError('')
    try {
      const res = await api.validatePromo({
        code: promoInput,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          configuration: selections(item),
        })),
      })
      setPromo(res.data.promo)
      setDiscountAmount(res.data.discountAmount || 0)
      setPromoInput(res.data.promo.code)
    } catch (err) {
      setPromo(null)
      setDiscountAmount(0)
      setPromoError(err.message || 'Invalid promo code')
    } finally {
      setPromoPending(false)
    }
  }

  function clearPromo() {
    setPromo(null)
    setDiscountAmount(0)
    setPromoInput('')
    setPromoError('')
  }

  function updateField(key, formatter) {
    return (event) => {
      const next = formatter ? formatter(event.target.value) : event.target.value
      setForm((prev) => ({ ...prev, [key]: next }))
      setFieldErrors((prev) => {
        if (!prev[key]) return prev
        const copy = { ...prev }
        delete copy[key]
        return copy
      })
      setError('')
    }
  }

  function applyDemoDetails() {
    setForm(demoDetailsFor(method))
    setFieldErrors({})
    setError('')
  }

  function selectMethod(choice) {
    setMethod(choice)
    setFieldErrors({})
    setError('')
  }

  async function purchase(event) {
    event.preventDefault()
    if (submitting.current) return

    const errors = validateDemoPayment(form, method)
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      setError('Fix the highlighted fields to complete the demo purchase.')
      return
    }

    const payload = buildDemoOrderPayload({
      items,
      form,
      method,
      expectedTotal: total,
      selections,
      promoCode: promo?.code || undefined,
    })

    if (!assertNoCardSecrets(payload)) {
      setError('Demo safety check failed — card details were not sent.')
      return
    }

    submitting.current = true
    setPending(true)
    setError('')
    try {
      const { data } = await api.createOrder(payload)
      clearPurchaseIntent()
      if (!buyNow) clearCart()
      navigate('/order/success?id=' + encodeURIComponent(data.order.id), { replace: true })
    } catch (err) {
      setError(err.message || 'The demo purchase could not be completed.')
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  if (!items?.length) {
    return (
      <div className="container-shell page-section">
        <EmptyState
          title="Nothing to check out"
          description="Select a product to start your order."
          actionLabel="Browse catalog"
          onAction={() => navigate('/catalog')}
        />
      </div>
    )
  }

  return (
    <main className="demo-checkout">
      <Link className="demo-back" to={buyNow ? '/products/' + items[0].productId : '/cart'}>
        <ArrowLeft size={16} /> Back to {buyNow ? 'product' : 'bag'}
      </Link>
      <div className="demo-title">
        <h1>Checkout</h1>
        <span>Demo mode</span>
      </div>
      <div className="demo-columns">
        <section className="demo-summary" aria-label="Order summary">
          <h2>Order summary</h2>
          {items.map((item) => (
            <article key={item.key || item.productId} className="demo-line">
              <img src={item.image || '/products/placeholder-phone.svg'} alt={item.name} />
              <div>
                <h3>{item.name}</h3>
                <p>{Object.values(selections(item)).join(' · ')}</p>
                <p>
                  Qty {item.quantity} · {money.format(item.unitPrice ?? item.price)} each
                </p>
              </div>
              <strong>{money.format(getLineTotal(item.unitPrice ?? item.price, item.quantity))}</strong>
            </article>
          ))}
          <div className="demo-promo">
            <label htmlFor="promoCode">
              <Tag size={16} /> Promo code
            </label>
            <div className="demo-promo-row">
              <input
                id="promoCode"
                value={promoInput}
                disabled={pending || promoPending}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="VOLTENIQ10"
              />
              {promo ? (
                <button type="button" onClick={clearPromo} disabled={pending}>
                  Remove
                </button>
              ) : (
                <button type="button" onClick={applyPromo} disabled={pending || promoPending || !promoInput.trim()}>
                  {promoPending ? 'Checking…' : 'Apply'}
                </button>
              )}
            </div>
            {promo ? (
              <p className="demo-promo-ok">
                {promo.code} applied · −{money.format(discountAmount)}
              </p>
            ) : null}
            {promoError ? <p className="demo-form-error">{promoError}</p> : null}
            <p className="demo-promo-hint">Try VOLTENIQ10 or SAVE25 — demo coupons only.</p>
          </div>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{money.format(subtotal)}</dd>
            </div>
            {discountAmount > 0 ? (
              <div>
                <dt>Discount</dt>
                <dd>−{money.format(discountAmount)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Delivery</dt>
              <dd>Free</dd>
            </div>
            <div className="demo-total">
              <dt>Total due</dt>
              <dd>{money.format(total)}</dd>
            </div>
          </dl>
        </section>

        <form className="demo-panel" onSubmit={purchase} noValidate>
          <h2>Payment method</h2>
          <div className="demo-methods" role="group" aria-label="Demo payment options">
            {PAYMENT_METHODS.map((choice) => (
              <button
                key={choice}
                type="button"
                disabled={pending}
                aria-pressed={choice === method}
                onClick={() => selectMethod(choice)}
              >
                {isCardMethod(choice) ? <CreditCard size={18} /> : <Wallet size={18} />}
                {choice}
              </button>
            ))}
          </div>

          <div className="demo-notice">
            <ShieldCheck size={20} />
            <p>
              Demo payment only. Enter sample details or use autofill. Card numbers and CVC stay in
              your browser — they are never stored or sent to the server.
            </p>
          </div>

          {card ? (
            <div className="demo-fields">
              <Field
                wide
                id="cardNumber"
                label="Card number"
                value={form.cardNumber}
                onChange={updateField('cardNumber', formatCardNumber)}
                error={fieldErrors.cardNumber}
                disabled={pending}
                inputMode="numeric"
                autoComplete="off"
                maxLength={19}
                placeholder={method === 'Mastercard' ? '5555 5555 5555 4444' : '4242 4242 4242 4242'}
              />
              <Field
                id="expiration"
                label="Expiration date"
                value={form.expiration}
                onChange={updateField('expiration', formatExpiration)}
                error={fieldErrors.expiration}
                disabled={pending}
                inputMode="numeric"
                autoComplete="off"
                maxLength={7}
                placeholder="MM / YY"
              />
              <Field
                id="cvc"
                label="CVC"
                value={form.cvc}
                onChange={updateField('cvc', formatCvc)}
                error={fieldErrors.cvc}
                disabled={pending}
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                placeholder="123"
              />
              <Field
                wide
                id="cardholderName"
                label="Cardholder name"
                value={form.cardholderName}
                onChange={updateField('cardholderName')}
                error={fieldErrors.cardholderName}
                disabled={pending}
                autoComplete="off"
                placeholder="Alex Sample"
              />
            </div>
          ) : (
            <p className="demo-wallet">{method} simulation uses a sample wallet. Billing details are still required.</p>
          )}

          <div className="demo-fields">
            {!card ? (
              <Field
                wide
                id="cardholderName"
                label="Cardholder name"
                value={form.cardholderName}
                onChange={updateField('cardholderName')}
                error={fieldErrors.cardholderName}
                disabled={pending}
                autoComplete="off"
                placeholder="Alex Sample"
              />
            ) : null}
            <Field
              wide
              id="billingAddress"
              label="Billing address"
              value={form.billingAddress}
              onChange={updateField('billingAddress')}
              error={fieldErrors.billingAddress}
              disabled={pending}
              autoComplete="off"
              placeholder="42 Sample Street"
            />
            <Field
              id="city"
              label="City"
              value={form.city}
              onChange={updateField('city')}
              error={fieldErrors.city}
              disabled={pending}
              autoComplete="off"
              placeholder="Test City"
            />
            <Field
              id="zip"
              label="ZIP / postal code"
              value={form.zip}
              onChange={updateField('zip')}
              error={fieldErrors.zip}
              disabled={pending}
              autoComplete="off"
              placeholder="00000"
            />
          </div>

          <button type="button" className="demo-fill" disabled={pending} onClick={applyDemoDetails}>
            Use demo details
          </button>

          {error ? (
            <p role="alert" className="demo-form-error">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? 'Saving demo order…' : 'Complete Demo Purchase'}
          </Button>
        </form>
      </div>
    </main>
  )
}

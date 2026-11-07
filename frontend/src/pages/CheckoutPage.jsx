import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { formatPrice } from '../utils/format'
import { formatVariantLabel, getLineTotal } from '../utils/pricing'
import {
  clearPurchaseIntent,
  loadPurchaseIntent,
} from '../utils/purchaseIntent'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'

export default function CheckoutPage() {
  const { items: cartItems, subtotal: cartSubtotal, clearCart } = useCart()
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const intent = loadPurchaseIntent()

  const checkoutItems = useMemo(() => {
    if (intent?.mode === 'buyNow' && intent.items?.length) {
      return intent.items
    }
    return cartItems
  }, [intent, cartItems])

  const subtotal = useMemo(() => {
    if (intent?.mode === 'buyNow' && intent.items?.length) {
      const sum = intent.items.reduce((acc, item) => {
        const unit = Number(item.unitPrice ?? item.price) || 0
        return acc + unit * item.quantity
      }, 0)
      return Math.round(sum * 100) / 100
    }
    return cartSubtotal
  }, [intent, cartSubtotal])

  const [form, setForm] = useState({
    name: user?.name || '',
    address: '',
    city: '',
    zip: '',
    country: 'Demo Country',
  })

  if (!isAuthenticated) {
    return null
  }

  if (!checkoutItems.length) {
    return (
      <div className="container-shell page-section">
        <EmptyState
          title="Nothing to check out"
          description="Browse the catalog or open your bag to continue."
          actionLabel="Go to catalog"
          onAction={() => navigate('/catalog')}
        />
      </div>
    )
  }

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.createOrder({
        items: checkoutItems.map((i) => {
          const skip = new Set([
            'key',
            'productId',
            'quantity',
            'name',
            'image',
            'price',
            'unitPrice',
            'stock',
          ])
          const configuration = Object.fromEntries(
            Object.entries(i).filter(([k, v]) => !skip.has(k) && v != null && v !== '')
          )
          return {
            productId: i.productId,
            quantity: i.quantity,
            ...configuration,
            configuration,
          }
        }),
        shipping: form,
      })
      const wasBuyNow = intent?.mode === 'buyNow'
      clearPurchaseIntent()
      if (!wasBuyNow) clearCart()
      navigate(`/profile?order=${res.data.order.id}`, { replace: true })
    } catch (err) {
      setError(err.message || 'Checkout failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-shell page-section">
      <h1 className="page-title mb-2">Demo checkout</h1>
      <p className="text-muted mb-6 sm:mb-8 text-sm sm:text-base break-words">
        Authenticated as {user?.email}. No payment is collected — demo order only.
      </p>

      <div className="split-layout">
        <form onSubmit={onSubmit} className="glass rounded-[16px] sm:rounded-[20px] p-4 sm:p-6 space-y-4 min-w-0">
          <div className="rounded-[14px] border border-volt/40 bg-volt/10 px-4 py-3 text-sm">
            Demo mode: do not enter real payment or card details. None are requested.
          </div>

          {['name', 'address', 'city', 'zip', 'country'].map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1.5 capitalize">
                {field === 'zip' ? 'ZIP / Postal code' : field}
              </label>
              <input
                required
                name={field}
                value={form[field]}
                onChange={onChange}
                className="w-full rounded-[14px] border border-silver/30 bg-white/50 dark:bg-graphite/50 px-4 py-2.5 outline-none focus:border-volt"
              />
            </div>
          ))}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Placing demo order...' : `Place demo order · ${formatPrice(subtotal)}`}
          </Button>
        </form>

        <aside className="glass rounded-[16px] sm:rounded-[20px] p-4 sm:p-6 h-fit lg:sticky lg:top-24 min-w-0">
          <h2 className="font-display text-xl font-bold mb-4">Order preview</h2>
          {intent?.mode === 'buyNow' ? (
            <p className="text-xs text-volt mb-3">Buy Now — selected configuration</p>
          ) : null}
          <ul className="space-y-3 mb-4">
            {checkoutItems.map((item) => {
              const unit = Number(item.unitPrice ?? item.price) || 0
              return (
                <li key={item.key || `${item.productId}-${item.storage}-${item.ram}`} className="flex justify-between gap-3 text-sm">
                  <span className="text-muted min-w-0">
                    {item.name} × {item.quantity}
                    <span className="block text-xs truncate">
                      {formatVariantLabel(item) || 'Standard'} · unit {formatPrice(unit)}
                    </span>
                  </span>
                  <span className="font-semibold shrink-0">
                    {formatPrice(getLineTotal(unit, item.quantity))}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="border-t border-silver/20 pt-4 flex justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold">{formatPrice(subtotal)}</span>
          </div>
          <Link to="/cart" className="block text-sm text-volt mt-4 hover:underline">
            Edit bag
          </Link>
        </aside>
      </div>
    </div>
  )
}

import { Link, useNavigate } from 'react-router-dom'
import { Trash2, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { formatPrice } from '../utils/format'
import { formatVariantLabel, getLineTotal } from '../utils/pricing'
import { beginCheckout } from '../utils/purchaseIntent'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'

export default function CartPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { items, updateQuantity, removeItem, subtotal, clearCart } = useCart()

  if (!items.length) {
    return (
      <div className="container-shell page-section">
        <EmptyState
          title="Your bag is empty"
          description="Browse the catalog and add demo products to get started."
          actionLabel="Shop catalog"
          onAction={() => navigate('/catalog')}
        />
      </div>
    )
  }

  return (
    <div className="container-shell page-section">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="page-title">Bag</h1>
          <p className="text-muted mt-1 text-sm sm:text-base">Demo cart — no payment required</p>
        </div>
        <button type="button" onClick={clearCart} className="text-sm text-muted hover:text-volt">
          Clear bag
        </button>
      </div>

      <div className="split-layout">
        <div className="space-y-3 sm:space-y-4 min-w-0">
          {items.map((item) => {
            const unit = Number(item.unitPrice ?? item.price) || 0
            const lineTotal = getLineTotal(unit, item.quantity)
            const maxStock = item.stock || 99
            return (
              <div
                key={item.key}
                className="glass rounded-[16px] p-3.5 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full sm:w-24 h-40 sm:h-24 rounded-[14px] object-contain bg-silver/10 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/products/${item.productId}`} className="font-semibold hover:text-volt break-words">
                        {item.name}
                      </Link>
                      <p className="text-xs text-muted mt-1 break-words">
                        {formatVariantLabel(item) || 'Standard config'}
                      </p>
                    </div>
                    <div className="text-right shrink-0 sm:hidden">
                      <p className="text-xs text-muted">Line</p>
                      <p className="font-bold">{formatPrice(lineTotal)}</p>
                    </div>
                  </div>
                  <p className="text-sm mt-2">
                    Unit <span className="font-bold">{formatPrice(unit)}</span>
                    <span className="text-muted"> · demo</span>
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="inline-flex items-center rounded-[12px] border border-silver/30">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        className="px-3.5 py-2 min-h-11 min-w-11 disabled:opacity-40 touch-manipulation"
                        disabled={item.quantity <= 1}
                        onClick={() => updateQuantity(item.key, item.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="px-3 py-2 text-sm font-semibold tabular-nums">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        className="px-3.5 py-2 min-h-11 min-w-11 disabled:opacity-40 touch-manipulation"
                        disabled={item.quantity >= maxStock}
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      className="inline-flex items-center justify-center min-h-10 min-w-10 text-muted hover:text-red-500 touch-manipulation"
                      aria-label="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="hidden sm:block text-right shrink-0">
                  <p className="text-xs text-muted mb-1">Line total</p>
                  <p className="font-bold">{formatPrice(lineTotal)}</p>
                </div>
              </div>
            )
          })}
        </div>

        <aside className="glass rounded-[16px] sm:rounded-[20px] p-5 sm:p-6 h-fit lg:sticky lg:top-24">
          <h2 className="font-display text-xl font-bold mb-4">Summary</h2>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted">Subtotal</span>
            <span className="font-semibold">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm mb-4">
            <span className="text-muted">Shipping</span>
            <span className="font-semibold">Demo free</span>
          </div>
          <div className="border-t border-silver/20 pt-4 flex justify-between mb-2">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold">{formatPrice(subtotal)}</span>
          </div>
          <p className="text-xs text-volt mb-6">DEMO PRICING — no real charges</p>
          <Button
            className="w-full"
            size="lg"
            onClick={() =>
              beginCheckout({
                isAuthenticated,
                navigate,
                intent: { mode: 'cart', items },
              })
            }
          >
            <Zap className="w-4 h-4" /> Buy Now
          </Button>
          <p className="text-[11px] text-muted text-center mt-3">
            {isAuthenticated
              ? 'Continues to protected demo checkout'
              : 'Sign in required — your bag will be waiting'}
          </p>
        </aside>
      </div>
    </div>
  )
}

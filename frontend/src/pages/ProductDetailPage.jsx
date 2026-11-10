import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Heart, GitCompareArrows, ShoppingBag, Star, ArrowLeft, Zap } from 'lucide-react'
import { api } from '../api/client'
import { formatPrice, formatRating } from '../utils/format'
import {
  clampQuantity,
  defaultSelections,
  formatVariantLabel,
  getLineTotal,
  getOptionPriceHints,
  getProductOptions,
  getUnitPrice,
  getVariantImage,
} from '../utils/pricing'
import { beginCheckout } from '../utils/purchaseIntent'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useFavorites } from '../context/FavoritesContext'
import { useCompare } from '../context/CompareContext'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import ErrorState from '../components/ui/ErrorState'
import ProductViewer from '../components/products/ProductViewer'
import PriceAlertButton from '../components/products/PriceAlertButton'
import { isLightSwatch, swatchColor } from '../utils/colorSwatches'

function OptionGroup({ label, options, value, onChange, priceHints, optionKey }) {
  if (!options?.length) return null
  const colorMode = optionKey === 'color' || label === 'Color'

  return (
    <div className="mb-6">
      <p className="text-sm font-semibold mb-2">
        {label}
        {colorMode && value ? <span className="ml-2 font-normal text-muted">· {value}</span> : null}
      </p>
      <div className={`flex flex-wrap ${colorMode ? 'gap-3' : 'gap-2'}`}>
        {options.map((option) =>
          colorMode ? (
            <button
              key={option}
              type="button"
              title={option}
              aria-label={option}
              aria-pressed={value === option}
              onClick={() => onChange(option)}
              className={`relative h-11 w-11 rounded-full border-2 transition touch-manipulation ${
                value === option ? 'border-volt scale-110' : 'border-silver/40 hover:border-volt/60'
              }`}
              style={{ backgroundColor: swatchColor(option) }}
            >
              {value === option ? (
                <span
                  className={`absolute inset-0 m-auto h-2 w-2 rounded-full ${
                    isLightSwatch(option) ? 'bg-ink' : 'bg-snow'
                  }`}
                />
              ) : null}
            </button>
          ) : (
            <button
              key={option}
              type="button"
              aria-pressed={value === option}
              onClick={() => onChange(option)}
              className={`rounded-full px-3.5 sm:px-4 py-2 text-sm border transition min-h-10 touch-manipulation ${
                value === option ? 'border-volt bg-volt/15' : 'border-silver/30'
              }`}
            >
              {option}
              {priceHints?.[option] != null && priceHints[option] !== '' ? (
                <span className="ml-1 text-xs text-muted">{priceHints[option]}</span>
              ) : null}
            </button>
          )
        )}
      </div>
    </div>
  )
}

import CompleteSetup from '../components/products/CompleteSetup'
import ProductExpert from '../components/products/ProductExpert'
import ProductReviews from '../components/reviews/ProductReviews'

export default function ProductDetailPage() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selections, setSelections] = useState({})
  const [qty, setQty] = useState(1)
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { addItem } = useCart()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { isCompared, toggleCompare } = useCompare()

  const load = () => {
    setLoading(true)
    setError('')
    api
      .getProduct(id)
      .then((res) => {
        const p = res.data.product
        setProduct(p)
        setSelections(defaultSelections(p))
        setQty(1)
      })
      .catch((err) => setError(err.message || 'Product not found'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const optionGroups = useMemo(() => getProductOptions(product), [product])

  const unitPrice = useMemo(
    () => (product ? getUnitPrice(product, selections) : 0),
    [product, selections]
  )

  const activeImage = useMemo(
    () => (product ? getVariantImage(product, selections) : ''),
    [product, selections]
  )

  const maxStock = product?.stock || 1
  const safeQty = clampQuantity(qty, maxStock)
  const lineTotal = getLineTotal(unitPrice, safeQty)

  const setOption = (key, value) => {
    setSelections((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="container-shell page-section">
        <ErrorState message={error || 'Product not found'} onRetry={load} />
      </div>
    )
  }

  const favorited = isFavorite(product.id)

  return (
    <div className="container-shell page-section">
      <Link to="/catalog" className="inline-flex items-center gap-2 text-sm text-muted hover:text-volt mb-5 sm:mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to catalog
      </Link>

      <div className="split-layout split-layout--equal">
        <div className="glass rounded-[16px] overflow-hidden min-w-0">
          <ProductViewer
            product={product}
            activeImage={activeImage}
            alt={`${product.name}${selections.color ? ` · ${selections.color}` : ''}`}
          />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="inline-flex rounded-full bg-volt/90 text-ink text-[10px] font-bold uppercase tracking-wider px-2.5 py-1">
              Demo price
            </span>
            {product.concept ? (
              <span className="inline-flex rounded-full bg-ink text-volt dark:bg-snow/10 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1">
                Concept — not an official Apple product
              </span>
            ) : null}
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted mb-2">{product.category}</p>
          <h1 className="page-title mb-3 break-words">{product.name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted mb-4">
            <Star className="w-4 h-4 fill-volt text-volt" />
            {formatRating(product.rating)} · {product.reviewCount} reviews
          </div>

          <div className="glass rounded-[16px] p-4 mb-6 space-y-2">
            <div className="flex items-end justify-between gap-3">
              <span className="text-sm text-muted">Unit price</span>
              <div className="text-right">
                {product.compareAt && Number(product.compareAt) > unitPrice ? (
                  <p className="text-sm text-muted line-through tabular-nums">{formatPrice(product.compareAt)}</p>
                ) : null}
                <span className="text-[clamp(1.5rem,1.2rem+1.5vw,1.875rem)] font-bold tabular-nums text-volt">
                  {formatPrice(unitPrice)}
                </span>
                {product.compareAt && Number(product.compareAt) > unitPrice ? (
                  <span className="ml-2 inline-flex rounded-full bg-volt/15 text-volt text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                    Save {formatPrice(Number(product.compareAt) - unitPrice)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-end justify-between gap-3">
              <span className="text-sm text-muted">
                Total ({safeQty} × {formatPrice(unitPrice)})
              </span>
              <span key={lineTotal} aria-live="polite" className="configuration-price text-xl font-bold text-volt">{formatPrice(lineTotal)}</span>
            </div>
            <p className="text-xs text-muted">
              Demo prices in USD. Storage and memory selections update your total.
            </p>
          </div>

          <p className="text-muted mb-6 leading-relaxed">{product.description}</p>

          <div className="glass rounded-[16px] p-4 mb-6">
            <p className="text-xs uppercase tracking-[0.18em] text-muted mb-2">
              Configurator Pro
            </p>
            <p className="text-sm font-medium break-words">
              {formatVariantLabel(selections, product) || 'Standard configuration'}
            </p>
            <p className="text-xs text-muted mt-2">
              {maxStock > 0
                ? `Available · ${maxStock} in demo stock for this model`
                : 'Currently sold out (demo)'}
            </p>
            <p className="text-sm mt-3">
              Unit <span className="font-bold">{formatPrice(unitPrice)}</span>
              <span className="text-muted"> · </span>
              Total <span className="font-bold text-volt">{formatPrice(lineTotal)}</span>
            </p>
          </div>

          {optionGroups.map((group) => (
            <OptionGroup
              key={group.key}
              optionKey={group.key}
              label={group.label}
              options={group.values}
              value={selections[group.key] || ''}
              onChange={(value) => setOption(group.key, value)}
              priceHints={getOptionPriceHints(product, group.key, formatPrice)}
            />
          ))}

          <div className="mb-6">
            <p className="text-sm font-semibold mb-2">Quantity</p>
            <div className="inline-flex items-center rounded-[14px] border border-silver/30">
              <button
                type="button"
                aria-label="Decrease quantity"
                        className="min-h-11 min-w-11 px-4 py-2 disabled:opacity-40"
                disabled={safeQty <= 1}
                onClick={() => setQty((q) => clampQuantity(q - 1, maxStock))}
              >
                −
              </button>
              <span className="px-4 py-2 min-w-12 text-center font-semibold">{safeQty}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                        className="min-h-11 min-w-11 px-4 py-2 disabled:opacity-40"
                disabled={safeQty >= maxStock}
                onClick={() => setQty((q) => clampQuantity(q + 1, maxStock))}
              >
                +
              </button>
            </div>
            <p className="text-xs text-muted mt-2">
              {maxStock} in stock (demo) · max {maxStock} per order line
            </p>
          </div>

          <div className="flex flex-col sm:flex-wrap sm:flex-row gap-3 mb-8">
            <Button
              size="lg"
              className="w-full sm:w-auto justify-center"
              disabled={maxStock < 1}
              onClick={() => {
                const buyItem = {
                  key: `${product.id}-buynow`,
                  productId: product.id,
                  name: product.name,
                  image: activeImage,
                  quantity: safeQty,
                  price: unitPrice,
                  unitPrice,
                  stock: maxStock,
                  ...selections,
                }
                beginCheckout({
                  isAuthenticated,
                  navigate,
                  intent: { mode: 'buyNow', items: [buyItem] },
                })
              }}
            >
              <Zap className="w-4 h-4" /> Buy Now · {formatPrice(lineTotal)}
            </Button>
            <Button
              variant="soft"
              size="lg"
              className="w-full sm:w-auto justify-center"
              disabled={maxStock < 1}
              onClick={() =>
                addItem(product, {
                  quantity: safeQty,
                  unitPrice,
                  ...selections,
                })
              }
            >
              <ShoppingBag className="w-4 h-4" /> Add to bag
            </Button>
            <div className="flex gap-3">
              <Button variant="ghost" size="lg" className="flex-1 sm:flex-none justify-center" onClick={() => toggleFavorite(product)}>
                <Heart className={`w-4 h-4 ${favorited ? 'fill-current text-volt' : ''}`} />
                {favorited ? 'Saved' : 'Save'}
              </Button>
              <Button variant="soft" size="lg" className="flex-1 sm:flex-none justify-center" onClick={() => toggleCompare(product.id)}>
                <GitCompareArrows className="w-4 h-4" />
                {isCompared(product.id) ? 'In compare' : 'Compare'}
              </Button>
            </div>
          </div>

          <div className="mb-8">
            <PriceAlertButton
              product={product}
              onPriceChanged={(data) => {
                if (data?.price != null) {
                  setProduct((prev) =>
                    prev
                      ? {
                          ...prev,
                          price: data.price,
                          variantPricing: prev.variantPricing
                            ? {
                                ...prev.variantPricing,
                                absolute: {
                                  ...prev.variantPricing.absolute,
                                  storage: Object.fromEntries(
                                    Object.entries(prev.variantPricing.absolute?.storage || {}).map(
                                      ([key, value], index) => [
                                        key,
                                        index === 0
                                          ? data.price
                                          : Math.round(Number(value) * (data.price / (data.previousPrice || value)) * 100) /
                                            100,
                                      ]
                                    )
                                  ),
                                },
                              }
                            : prev.variantPricing,
                        }
                      : prev
                  )
                }
              }}
            />
          </div>

          {product.specs && (
            <div className="glass rounded-[18px] p-5">
              <h3 className="font-semibold mb-3">Specifications</h3>
              <dl className="grid sm:grid-cols-2 gap-3">
                {Object.entries(product.specs).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs uppercase tracking-wider text-muted">{key}</dt>
                    <dd className="text-sm font-medium">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
      <ProductExpert key={product.id + JSON.stringify(selections)} product={product} selections={selections} unitPrice={unitPrice} />
      <CompleteSetup key={product.id} product={product} selections={selections} unitPrice={unitPrice} quantity={safeQty} />
      <ProductReviews
        productId={product.id}
        onStats={(summary) => {
          if (!summary) return
          setProduct((prev) =>
            prev
              ? { ...prev, rating: summary.average, reviewCount: summary.reviewCount }
              : prev
          )
        }}
      />
    </div>
  )
}

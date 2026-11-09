import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, ShoppingBag, Eye } from 'lucide-react'
import { formatPrice } from '../../utils/format'
import { defaultSelections, getUnitPrice, getVariantImage } from '../../utils/pricing'
import { isLightSwatch, swatchColor } from '../../utils/colorSwatches'
import { useCart } from '../../context/CartContext'
import { useFavorites } from '../../context/FavoritesContext'
import Button from '../ui/Button'

export default function ProductCard({ product }) {
  const { addItem } = useCart()
  const { isFavorite, toggleFavorite } = useFavorites()
  const favorited = isFavorite(product.id)
  const inStock = Number(product.stock) > 0
  const detailTo = `/products/${product.slug || product.id}`
  const starting = defaultSelections(product)
  const colors = product.colors?.length
    ? product.colors
    : product.options?.find((o) => o.key === 'color')?.values || []
  const [color, setColor] = useState(starting.color || colors[0] || null)
  const selections = { ...starting, ...(color ? { color } : {}) }
  const startingPrice = getUnitPrice(product, selections)
  const cardImage = getVariantImage(product, selections)
  const showSwatches = colors.length > 1

  return (
    <article className="glass-card product-card group relative">
      <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap gap-1 max-w-[calc(100%-3.25rem)]">
        <span className="rounded-full bg-volt text-ink text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-1 shadow-[0_0_16px_rgba(255,121,0,0.35)]">
          Demo
        </span>
        {product.concept ? (
          <span className="rounded-full bg-ink/80 dark:bg-snow/90 text-snow dark:text-ink text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-1">
            Concept
          </span>
        ) : null}
        <span
          className={`rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-1 ${
            inStock ? 'bg-emerald-500/90 text-ink' : 'bg-red-500/90 text-snow'
          }`}
        >
          {inStock ? 'In stock' : 'Sold out'}
        </span>
      </div>

      <button
        type="button"
        aria-label="Toggle favorite"
        onClick={() => toggleFavorite(product)}
        className={`absolute top-2.5 right-2.5 z-10 inline-flex items-center justify-center rounded-full min-h-10 min-w-10 border border-silver/20 backdrop-blur-md transition touch-manipulation ${
          favorited ? 'bg-volt text-ink border-volt/40' : 'bg-white/55 dark:bg-ink/55 text-ink dark:text-snow'
        }`}
      >
        <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
      </button>

      <Link to={detailTo} className="flex min-w-0 flex-1 flex-col">
        <div className="product-media product-card__media shrink-0 overflow-hidden border border-silver/15 bg-gradient-to-b from-white/55 to-white/10 dark:from-white/8 dark:to-transparent">
          <img
            src={cardImage}
            alt={`${product.name}${color ? ` · ${color}` : ''}`}
            className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.04]"
            loading="lazy"
            onError={(e) => {
              if (e.currentTarget.dataset.fallback === '1') return
              e.currentTarget.dataset.fallback = '1'
              e.currentTarget.src = '/products/placeholder-phone.svg'
            }}
          />
        </div>
        <div className="product-card__body">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-muted truncate">
            {product.category}
          </p>
          <h3 className="product-card__title font-display font-bold group-hover:text-volt transition-colors">
            {product.name}
          </h3>
          {showSwatches ? (
            <p className="text-xs text-muted truncate">{color}</p>
          ) : (
            <p className="text-xs text-transparent select-none" aria-hidden="true">
              &nbsp;
            </p>
          )}
          <div className="product-card__price flex items-end gap-2 flex-wrap">
            <span className="font-bold text-volt">{formatPrice(startingPrice)}</span>
            {product.compareAt ? (
              <span className="text-xs sm:text-sm text-muted line-through">
                {formatPrice(product.compareAt)}
              </span>
            ) : null}
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
              Demo USD
            </span>
          </div>
        </div>
      </Link>

      <div className="product-card__swatches" role={showSwatches ? 'group' : undefined} aria-label={showSwatches ? `${product.name} colors` : undefined}>
        {showSwatches
          ? colors.map((finish) => (
              <button
                key={finish}
                type="button"
                title={finish}
                aria-label={finish}
                aria-pressed={color === finish}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setColor(finish)
                }}
                className={`h-8 w-8 rounded-full border-2 transition touch-manipulation ${
                  color === finish ? 'border-volt scale-110' : 'border-silver/40 hover:border-volt/50'
                }`}
                style={{ backgroundColor: swatchColor(finish) }}
              >
                {color === finish ? (
                  <span
                    className={`block mx-auto h-1.5 w-1.5 rounded-full ${
                      isLightSwatch(finish) ? 'bg-ink' : 'bg-snow'
                    }`}
                  />
                ) : null}
              </button>
            ))
          : null}
      </div>

      <div className="product-card__actions">
        <Button
          className="w-full"
          size="md"
          disabled={!inStock}
          onClick={() =>
            addItem(product, {
              ...selections,
              quantity: 1,
              unitPrice: startingPrice,
            })
          }
        >
          <ShoppingBag className="w-4 h-4" />
          <span className="truncate">Add to Cart</span>
        </Button>
        <Button as={Link} to={detailTo} variant="ghost" size="md" className="w-full">
          <Eye className="w-4 h-4" />
          <span className="truncate">View Details</span>
        </Button>
      </div>
    </article>
  )
}

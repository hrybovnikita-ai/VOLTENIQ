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
    <article className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[16px] border border-silver/25 bg-white/70 dark:bg-graphite/70 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-volt/40 hover:shadow-[0_12px_36px_rgba(255,121,0,0.16)]">
      <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap gap-1 max-w-[calc(100%-3.25rem)]">
        <span className="rounded-full bg-volt text-ink text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-1">
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
        className={`absolute top-2.5 right-2.5 z-10 inline-flex items-center justify-center rounded-full min-h-10 min-w-10 backdrop-blur transition touch-manipulation ${
          favorited ? 'bg-volt text-ink' : 'bg-white/80 dark:bg-ink/70 text-ink dark:text-snow'
        }`}
      >
        <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
      </button>

      <Link to={detailTo} className="flex min-w-0 flex-1 flex-col">
        <div className="product-media aspect-square shrink-0 overflow-hidden bg-gradient-to-b from-silver/15 to-transparent dark:from-ink/50">
          <img
            src={cardImage}
            alt={`${product.name}${color ? ` · ${color}` : ''}`}
            className="h-full w-full object-contain p-4 sm:p-6 transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
            onError={(e) => {
              if (e.currentTarget.dataset.fallback === '1') return
              e.currentTarget.dataset.fallback = '1'
              e.currentTarget.src = '/products/placeholder-phone.svg'
            }}
          />
        </div>
        <div className="flex flex-1 flex-col px-3 sm:px-5 pt-2 pb-3 min-w-0">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-muted mb-1 truncate">
            {product.category}
          </p>
          <h3 className="font-display text-sm sm:text-lg font-bold mb-2 line-clamp-2 min-h-[2.5rem] sm:min-h-[2.75rem] group-hover:text-volt transition-colors">
            {product.name}
          </h3>
          {showSwatches ? (
            <p className="text-xs text-muted mb-2 truncate">{color}</p>
          ) : null}
          <div className="mt-auto flex items-end gap-2 flex-wrap">
            <span className="text-base sm:text-xl font-bold">{formatPrice(startingPrice)}</span>
            {product.compareAt ? (
              <span className="text-xs sm:text-sm text-muted line-through">
                {formatPrice(product.compareAt)}
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      {showSwatches ? (
        <div
          className="px-3 sm:px-5 pb-2 flex flex-wrap gap-2"
          role="group"
          aria-label={`${product.name} colors`}
        >
          {colors.map((finish) => (
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
          ))}
        </div>
      ) : null}

      <div className="px-3 sm:px-5 pb-3 sm:pb-5 flex flex-col gap-2">
        <Button
          className="w-full"
          size="sm"
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
        <Button as={Link} to={detailTo} variant="ghost" size="sm" className="w-full">
          <Eye className="w-4 h-4" />
          <span className="truncate">View Details</span>
        </Button>
      </div>
    </article>
  )
}

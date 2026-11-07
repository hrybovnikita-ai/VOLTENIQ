import { Link } from 'react-router-dom'
import { Heart, ShoppingBag, Eye } from 'lucide-react'
import { formatPrice } from '../../utils/format'
import { defaultSelections, getUnitPrice, getVariantImage } from '../../utils/pricing'
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
  const startingPrice = getUnitPrice(product, starting)
  const cardImage = getVariantImage(product, starting)

  return (
    <article className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[16px] border border-silver/25 bg-white/70 dark:bg-graphite/70 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-volt/40 hover:shadow-[0_12px_36px_rgba(255,121,0,0.16)]">
      <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5 max-w-[calc(100%-3.5rem)]">
        <span className="rounded-full bg-volt text-ink text-[10px] font-bold uppercase tracking-wider px-2 py-1">
          Demo price
        </span>
        {product.concept ? (
          <span className="rounded-full bg-ink/80 dark:bg-snow/90 text-snow dark:text-ink text-[10px] font-bold uppercase tracking-wider px-2 py-1">
            Concept
          </span>
        ) : null}
        <span
          className={`rounded-full text-[10px] font-bold uppercase tracking-wider px-2 py-1 ${
            inStock
              ? 'bg-emerald-500/90 text-ink'
              : 'bg-red-500/90 text-snow'
          }`}
        >
          {inStock ? 'In stock' : 'Sold out'}
        </span>
      </div>

      <button
        type="button"
        aria-label="Toggle favorite"
        onClick={() => toggleFavorite(product)}
        className={`absolute top-3 right-3 z-10 rounded-full p-2 backdrop-blur transition ${
          favorited ? 'bg-volt text-ink' : 'bg-white/80 dark:bg-ink/70 text-ink dark:text-snow'
        }`}
      >
        <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
      </button>

      <Link to={detailTo} className="flex min-w-0 flex-1 flex-col">
        <div className="product-media aspect-square shrink-0 overflow-hidden bg-gradient-to-b from-silver/15 to-transparent dark:from-ink/50">
          <img
            src={cardImage}
            alt={product.name}
            className="h-full w-full object-contain p-5 sm:p-6 transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
            onError={(e) => {
              if (e.currentTarget.dataset.fallback === '1') return
              e.currentTarget.dataset.fallback = '1'
              e.currentTarget.src = '/products/placeholder-phone.svg'
            }}
          />
        </div>
        <div className="flex flex-1 flex-col px-4 sm:px-5 pt-2 pb-3 min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-muted mb-1 truncate">
            {product.category}
          </p>
          <h3 className="font-display text-base sm:text-lg font-bold mb-2 line-clamp-2 min-h-[2.75rem] group-hover:text-volt transition-colors">
            {product.name}
          </h3>
          <div className="mt-auto flex items-end gap-2 flex-wrap">
            <span className="text-lg sm:text-xl font-bold">{formatPrice(startingPrice)}</span>
            {product.compareAt ? (
              <span className="text-sm text-muted line-through">
                {formatPrice(product.compareAt)}
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex flex-col gap-2">
        <Button
          className="w-full"
          disabled={!inStock}
          onClick={() =>
            addItem(product, {
              ...starting,
              quantity: 1,
              unitPrice: startingPrice,
            })
          }
        >
          <ShoppingBag className="w-4 h-4" />
          Add to Cart
        </Button>
        <Button as={Link} to={detailTo} variant="ghost" className="w-full">
          <Eye className="w-4 h-4" />
          View Details
        </Button>
      </div>
    </article>
  )
}

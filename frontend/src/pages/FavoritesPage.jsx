import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, ShoppingBag } from 'lucide-react'
import { api } from '../api/client'
import { useFavorites } from '../context/FavoritesContext'
import { useCart } from '../context/CartContext'
import ProductCard from '../components/products/ProductCard'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import { defaultSelections } from '../utils/pricing'

export default function FavoritesPage() {
  const { ids, products, setProducts, toggleFavorite } = useFavorites()
  const { addItem } = useCart()
  const [loading, setLoading] = useState(false)
  const [shareStatus, setShareStatus] = useState('')
  const [notice, setNotice] = useState('')
  const shareUrl = new URL('/wishlist', window.location.origin)
  for (const product of products) shareUrl.searchParams.append('item', product.slug || product.id)

  async function share() {
    try {
      await navigator.clipboard.writeText(shareUrl.href)
      setShareStatus('Link copied')
    } catch {
      setShareStatus('Copy the link below')
    }
  }

  const navigate = useNavigate()

  useEffect(() => {
    if (!ids.length) {
      setProducts([])
      return
    }
    setLoading(true)
    api
      .getProducts({})
      .then((res) => {
        const all = res.data.products || []
        setProducts(all.filter((p) => ids.includes(p.id)))
      })
      .finally(() => setLoading(false))
  }, [ids, setProducts])

  const moveToCart = (product) => {
    addItem(product, { ...defaultSelections(product), quantity: 1 })
    setNotice(`${product.name} added to bag`)
    window.setTimeout(() => setNotice(''), 2500)
  }

  const moveAllToCart = () => {
    for (const product of products) {
      addItem(product, { ...defaultSelections(product), quantity: 1 })
    }
    setNotice(`${products.length} items added to bag`)
    window.setTimeout(() => setNotice(''), 2500)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  if (!products.length) {
    return (
      <div className="container-shell page-section">
        <EmptyState
          icon={<Heart className="w-10 h-10" />}
          title="No favorites yet"
          description="Tap the heart on any product to save it here."
          actionLabel="Browse catalog"
          onAction={() => navigate('/catalog')}
        />
      </div>
    )
  }

  return (
    <div className="container-shell page-section">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="page-title mb-2">Favorites</h1>
          <p className="text-muted text-sm sm:text-base">{products.length} saved products</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" onClick={share}>
            Share wishlist
          </Button>
          <Button onClick={moveAllToCart}>
            <ShoppingBag className="w-4 h-4 mr-1.5" />
            Add all to bag
          </Button>
        </div>
      </div>

      {notice && (
        <p role="status" className="mb-4 rounded-[12px] border border-volt/40 bg-volt/10 px-4 py-2 text-sm">
          {notice}
        </p>
      )}
      <p role="status" className="text-sm mb-2">
        {shareStatus}
      </p>
      {shareStatus && (
        <input
          aria-label="Read-only wishlist link"
          className="mb-4 w-full rounded border p-2 text-ink bg-white"
          readOnly
          value={shareUrl.href}
          onFocus={(event) => event.target.select()}
        />
      )}

      <div className="product-grid">
        {products.map((product) => (
          <div key={product.id} className="space-y-2">
            <ProductCard product={product} />
            <div className="flex gap-2">
              <Button className="flex-1" size="sm" onClick={() => moveToCart(product)}>
                Move to bag
              </Button>
              <Button variant="ghost" size="sm" onClick={() => toggleFavorite(product)}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

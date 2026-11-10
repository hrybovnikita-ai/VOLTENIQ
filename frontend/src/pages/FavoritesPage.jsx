import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { api } from '../api/client'
import { useFavorites } from '../context/FavoritesContext'
import ProductCard from '../components/products/ProductCard'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'

export default function FavoritesPage() {
  const { ids, products, setProducts } = useFavorites()
  const [loading, setLoading] = useState(false)
  const [shareStatus, setShareStatus] = useState('')
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
      <h1 className="page-title mb-2">Favorites</h1>
      <p className="text-muted mb-6 sm:mb-8 text-sm sm:text-base">{products.length} saved products</p>
      <button type="button" className="mb-3 rounded-lg bg-volt px-4 py-2 font-semibold text-ink" onClick={share}>Share wishlist</button>
      <p role="status" className="text-sm">{shareStatus}</p>
      {shareStatus && <input aria-label="Read-only wishlist link" className="my-3 w-full rounded border p-2 text-ink bg-white" readOnly value={shareUrl.href} onFocus={event => event.target.select()} />}
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}

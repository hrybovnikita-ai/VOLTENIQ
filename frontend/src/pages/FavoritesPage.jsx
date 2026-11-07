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
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}

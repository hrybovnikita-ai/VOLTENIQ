import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { formatPrice } from '../utils/format'

export default function SharedWishlist() {
  const [params] = useSearchParams()
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api.getProducts().then(({ data }) => {
      if (active) setCatalog(data.products)
    }).catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [])

  const items = [...new Set(params.getAll('item'))]
  const products = items.map(item => catalog?.find(p => p.slug === item || p.id === item)).filter(Boolean)
  return (
    <main className="container-shell page-section">
      <h1 className="page-title mb-4">Shared wishlist</h1>
      <p role="status" className="mb-5 text-muted">{error || (catalog === null ? 'Loading wishlist…' :
        products.length === 0 ? 'No available products in this wishlist.' :
        products.length < items.length ? 'Some products are no longer available.' : 'Read-only wishlist')}</p>
      <div className="product-grid">
        {products.map(p => (
          <Link key={p.id} to={'/products/' + (p.slug || p.id)} className="glass-card p-4">
            <img src={p.image} alt="" className="aspect-square w-full object-contain" />
            <h2 className="mt-3 font-semibold">{p.name}</h2>
            <p>{formatPrice(p.price)}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}

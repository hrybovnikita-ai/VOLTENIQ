import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import ProductCard from '../components/products/ProductCard'
import PriceRangeFilter from '../components/catalog/PriceRangeFilter'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'rating', label: 'Top rated' },
]

export default function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(
    () => ({
      search: params.get('search') || '',
      category: params.get('category') || 'all',
      sort: params.get('sort') || 'newest',
      minPrice: params.get('minPrice') || '',
      maxPrice: params.get('maxPrice') || '',
    }),
    [params]
  )

  const { data, loading, error, reload } = useApi(
    () =>
      api.getProducts(filters).then((res) => ({
        products: res.data.products || [],
        categories: res.data.categories || [],
      })),
    [filters.search, filters.category, filters.sort, filters.minPrice, filters.maxPrice]
  )

  const products = data?.products || []
  const categories = data?.categories || []

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next)
  }

  const updatePriceRange = ({ minPrice, maxPrice }) => {
    const next = new URLSearchParams(params)
    if (!minPrice) next.delete('minPrice')
    else next.set('minPrice', minPrice)
    if (!maxPrice) next.delete('maxPrice')
    else next.set('maxPrice', maxPrice)
    setParams(next)
  }

  return (
    <div className="container-shell page-section">
      <div className="mb-6 sm:mb-8">
        <h1 className="page-title mb-2">Catalog</h1>
        <p className="text-muted text-sm sm:text-base">
          Explore the full demo lineup. All prices are <span className="text-volt font-semibold">DEMO</span> USD
          prices — no real payments.
        </p>
      </div>

      <div className="glass rounded-[16px] p-3 sm:p-4 mb-5 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search iPhone, MacBook, AirPods..."
            className="w-full rounded-[14px] border border-silver/30 bg-white/50 dark:bg-graphite/50 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-volt"
          />
        </div>
        <select
          value={filters.sort}
          onChange={(e) => updateFilter('sort', e.target.value)}
          className="w-full sm:w-auto rounded-[14px] border border-silver/30 bg-white/50 dark:bg-graphite/50 px-4 py-2.5 text-sm outline-none focus:border-volt"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <PriceRangeFilter
        minPrice={filters.minPrice}
        maxPrice={filters.maxPrice}
        onChange={updatePriceRange}
      />

      <div className="mb-6 sm:mb-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateFilter('category', 'all')}
          className={`rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium border transition ${
            filters.category === 'all'
              ? 'bg-volt text-ink border-volt'
              : 'border-silver/30 hover:border-volt'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => updateFilter('category', cat.id)}
            className={`rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium border transition ${
              filters.category === cat.id
                ? 'bg-volt text-ink border-volt'
                : 'border-silver/30 hover:border-volt'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && products.length === 0 && (
        <EmptyState
          title="No products found"
          description="Try another search, category, or DEMO price range."
          actionLabel="Clear filters"
          onAction={() => setParams({})}
        />
      )}
      {!loading && !error && products.length > 0 && (
        <>
          <p className="text-sm text-muted mb-4">
            {products.length} products · demo USD prices
            {(filters.minPrice || filters.maxPrice) && (
              <span>
                {' '}
                · filtered
                {filters.minPrice ? ` from $${Number(filters.minPrice).toLocaleString('en-US')}` : ''}
                {filters.maxPrice ? ` to $${Number(filters.maxPrice).toLocaleString('en-US')}` : '+'}
              </span>
            )}
          </p>
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

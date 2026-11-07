import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GitCompareArrows, X } from 'lucide-react'
import { api } from '../api/client'
import { useCompare } from '../context/CompareContext'
import { formatPrice, formatRating } from '../utils/format'
import { COMPARE_ROWS, getCompareValue, valuesDiffer } from '../utils/compare'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import ErrorState from '../components/ui/ErrorState'

function renderCell(product, key) {
  const value = getCompareValue(product, key)
  if (key === 'price') {
    return (
      <>
        {formatPrice(value)}{' '}
        <span className="text-[10px] uppercase text-muted font-bold">demo</span>
      </>
    )
  }
  if (key === 'rating' && value !== '—') {
    return `${formatRating(value)} (${product.reviewCount || 0})`
  }
  return String(value)
}

export default function ComparePage() {
  const { ids, toggleCompare, clearCompare } = useCompare()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [onlyDiffs, setOnlyDiffs] = useState(false)
  const navigate = useNavigate()

  const load = () => {
    if (!ids.length) {
      setProducts([])
      return
    }
    setLoading(true)
    setError('')
    api
      .compareProducts(ids)
      .then((res) => setProducts(res.data.products || []))
      .catch((err) => setError(err.message || 'Failed to load comparison'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')])

  const rows = useMemo(() => {
    const base = [...COMPARE_ROWS]
    const extraKeys = Array.from(
      new Set(products.flatMap((p) => Object.keys(p.specs || {})))
    ).filter((key) => !base.some((row) => row.key === key))
    extraKeys.forEach((key) => base.push({ key, label: key }))
    if (!onlyDiffs || products.length < 2) return base
    return base.filter((row) => valuesDiffer(products, row.key))
  }, [products, onlyDiffs])

  if (!ids.length) {
    return (
      <div className="container-shell page-section">
        <EmptyState
          icon={<GitCompareArrows className="w-10 h-10" />}
          title="Nothing to compare"
          description="Add up to 4 products from the catalog to compare specs and demo prices."
          actionLabel="Browse catalog"
          onAction={() => navigate('/catalog')}
        />
      </div>
    )
  }

  return (
    <div className="container-shell page-section">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="page-title">Compare</h1>
          <p className="text-muted mt-1 text-sm sm:text-base">
            Up to 4 products · differences highlighted in orange
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={onlyDiffs ? 'soft' : 'ghost'}
            onClick={() => setOnlyDiffs((v) => !v)}
            className="shrink-0"
          >
            {onlyDiffs ? 'Show all rows' : 'Differences only'}
          </Button>
          <Button variant="ghost" onClick={clearCompare} className="shrink-0">
            Clear all
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && (
        <div className="overflow-x-auto scrollbar-thin -mx-1 px-1">
          <table className="min-w-full glass rounded-[20px] overflow-hidden">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white/95 dark:bg-graphite/95 p-3 sm:p-4 text-left text-sm text-muted w-28 sm:w-40">
                  Feature
                </th>
                {products.map((p) => (
                  <th key={p.id} className="p-3 sm:p-4 text-left align-top min-w-[160px] sm:min-w-[200px]">
                    <div className="relative pr-6">
                      <button
                        type="button"
                        onClick={() => toggleCompare(p.id)}
                        className="absolute -top-1 right-0 rounded-full p-1 hover:bg-silver/20"
                        aria-label={`Remove ${p.name}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <Link to={`/products/${p.slug || p.id}`}>
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-full h-28 sm:h-36 object-contain rounded-[14px] mb-3 bg-silver/10 dark:bg-ink/40 p-2"
                        />
                        <p className="font-semibold hover:text-volt break-words">{p.name}</p>
                      </Link>
                      <p className="text-volt font-bold mt-1">{formatPrice(p.price)}</p>
                    </div>
                  </th>
                ))}
                {products.length < 4 ? (
                  <th className="p-3 sm:p-4 align-top min-w-[140px]">
                    <button
                      type="button"
                      onClick={() => navigate('/catalog')}
                      className="w-full h-28 sm:h-36 rounded-[14px] border border-dashed border-silver/40 text-sm text-muted hover:border-volt hover:text-volt"
                    >
                      Add product
                    </button>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const diff = valuesDiffer(products, row.key)
                return (
                  <tr key={row.key} className="border-t border-silver/20">
                    <td
                      className={`sticky left-0 z-10 p-3 sm:p-4 text-sm capitalize ${
                        diff
                          ? 'bg-volt/10 text-ink dark:text-snow font-semibold'
                          : 'bg-white/95 dark:bg-graphite/95 text-muted'
                      }`}
                    >
                      {row.label}
                    </td>
                    {products.map((p) => (
                      <td
                        key={p.id}
                        className={`p-3 sm:p-4 text-sm break-words ${
                          diff ? 'bg-volt/5 font-medium' : ''
                        }`}
                      >
                        {renderCell(p, row.key)}
                      </td>
                    ))}
                    {products.length < 4 ? <td className="p-3 sm:p-4" /> : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

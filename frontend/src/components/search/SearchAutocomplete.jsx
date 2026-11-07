import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Search } from 'lucide-react'
import { api } from '../../api/client'
import { formatPrice } from '../../utils/format'

export default function SearchAutocomplete({
  className = '',
  inputClassName = '',
  autoFocus = false,
  onNavigate,
}) {
  const navigate = useNavigate()
  const listId = useId()
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 1) {
      setSuggestions([])
      setSearched(false)
      setActiveIndex(-1)
      setLoading(false)
      return undefined
    }

    const handle = setTimeout(() => {
      setLoading(true)
      api
        .suggestProducts(q, 10)
        .then((res) => {
          setSuggestions(res.data.products || [])
          setSearched(true)
          setActiveIndex(-1)
          setOpen(true)
        })
        .catch(() => {
          setSuggestions([])
          setSearched(true)
          setOpen(true)
        })
        .finally(() => setLoading(false))
    }, 180)

    return () => clearTimeout(handle)
  }, [query])

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const goCatalog = (value = query) => {
    const q = value.trim()
    setOpen(false)
    setActiveIndex(-1)
    onNavigate?.()
    navigate(q ? `/catalog?search=${encodeURIComponent(q)}` : '/catalog')
  }

  const goProduct = (product) => {
    setOpen(false)
    setActiveIndex(-1)
    setQuery(product.name)
    onNavigate?.()
    navigate(`/products/${product.slug || product.id}`)
  }

  const onSubmit = (event) => {
    event.preventDefault()
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      goProduct(suggestions[activeIndex])
      return
    }
    goCatalog()
  }

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
      return
    }

    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length) {
      setOpen(true)
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!suggestions.length) return
      setOpen(true)
      setActiveIndex((index) => (index + 1) % suggestions.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!suggestions.length) return
      setOpen(true)
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1))
    }
  }

  const showPanel = open && query.trim().length > 0

  return (
    <form ref={rootRef} onSubmit={onSubmit} className={`relative w-full ${className}`} role="search">
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-volt pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (query.trim()) setOpen(true)
          }}
          onKeyDown={onKeyDown}
          placeholder="Search products..."
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showPanel}
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          className={
            inputClassName ||
            'w-full rounded-[14px] border border-silver/30 bg-white/60 dark:bg-graphite/60 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-volt'
          }
        />
      </div>

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[60] max-h-80 overflow-y-auto rounded-[16px] border border-silver/20 bg-[#1a1a1a] text-snow shadow-[0_20px_50px_rgba(0,0,0,0.45)] scrollbar-thin"
        >
          <p className="px-4 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-silver/70">
            Suggested products
          </p>

          {loading && (
            <p className="px-4 py-3 text-sm text-muted">Searching…</p>
          )}

          {!loading && searched && suggestions.length === 0 && (
            <p className="px-4 py-4 text-sm text-muted">No products found</p>
          )}

          {!loading &&
            suggestions.map((product, index) => {
              const active = index === activeIndex
              return (
                <button
                  key={product.id}
                  id={`${listId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => goProduct(product)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                    active ? 'bg-volt/15' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-graphite">
                    <img
                      src={product.image}
                      alt=""
                      className="h-full w-full object-contain p-1"
                      loading="lazy"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-snow">
                        {product.name}
                      </span>
                      {product.concept ? (
                        <span className="shrink-0 rounded-full bg-volt/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-volt">
                          Concept
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-silver/70">
                      Demo {formatPrice(product.price)}
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-silver/50" />
                </button>
              )
            })}

          <button
            type="submit"
            className="sticky bottom-0 w-full border-t border-white/10 bg-[#141414] px-4 py-3 text-left text-xs font-semibold text-volt hover:bg-white/5"
          >
            View all results for “{query.trim()}”
          </button>
        </div>
      )}
    </form>
  )
}

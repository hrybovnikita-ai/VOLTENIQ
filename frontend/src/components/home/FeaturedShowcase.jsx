import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatPrice } from '../../utils/format'

const SHOWCASE_SLUGS = [
  'iphone-18-pro',
  'iphone-16-pro',
  'macbook-pro',
  'imac-m4-4-port',
  'mac-studio',
  'magic-keyboard',
  'airpods-pro',
  'apple-watch',
]

function shortCopy(product) {
  const raw = String(product.description || product.category || '').trim()
  if (!raw) return 'Premium demo listing from the VOLTENIQ catalog.'
  const sentence = raw.split(/(?<=[.!?])\s+/)[0] || raw
  return sentence.length > 96 ? `${sentence.slice(0, 93).trim()}…` : sentence
}

function pickShowcaseProducts(products = []) {
  const bySlug = new Map(products.map((product) => [product.slug, product]))
  const selected = SHOWCASE_SLUGS.map((slug) => bySlug.get(slug)).filter(Boolean)
  if (selected.length >= 6) return selected

  const extras = products.filter((product) => !selected.some((item) => item.id === product.id))
  return [...selected, ...extras].slice(0, 8)
}

function ShowcaseCard({ product }) {
  const detailTo = `/products/${product.slug || product.id}`
  const image = product.image || product.images?.[0] || '/products/placeholder-phone.svg'

  return (
    <Link to={detailTo} className="showcase-card group" draggable={false}>
      <div className="showcase-card__media">
        <img
          src={image}
          alt={product.name}
          loading="lazy"
          draggable={false}
          onError={(event) => {
            if (event.currentTarget.dataset.fallback === '1') return
            event.currentTarget.dataset.fallback = '1'
            event.currentTarget.src = '/products/placeholder-phone.svg'
          }}
        />
      </div>
      <div className="showcase-card__body">
        <p className="showcase-card__eyebrow">{product.category}</p>
        <h3 className="showcase-card__title">{product.name}</h3>
        <p className="showcase-card__copy">{shortCopy(product)}</p>
        <p className="showcase-card__price">
          <span>{formatPrice(product.price)}</span>
          <span className="showcase-card__demo">Demo USD</span>
        </p>
      </div>
    </Link>
  )
}

export default function FeaturedShowcase({ products = [] }) {
  const items = useMemo(() => pickShowcaseProducts(products), [products])
  const loopItems = useMemo(() => (items.length ? [...items, ...items] : []), [items])
  const trackRef = useRef(null)
  const dragRef = useRef({ active: false, startX: 0, origin: 0, moved: false })
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)

  const nudge = (direction) => {
    const track = trackRef.current
    if (!track) return
    const card = track.querySelector('.showcase-card')
    const styles = card ? window.getComputedStyle(track) : null
    const gap = styles ? Number.parseFloat(styles.columnGap || styles.gap || '16') : 16
    const step = (card?.getBoundingClientRect().width || 300) + gap
    setOffset((value) => value + direction * step)
  }

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    dragRef.current = {
      active: true,
      startX: event.clientX,
      origin: offset,
      moved: false,
    }
    setDragging(true)
    // Keep taps targeted at the product link while tracking drags outside it.
    const target = event.target.closest('.showcase-card') || event.currentTarget
    target.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event) => {
    const drag = dragRef.current
    if (!drag.active) return
    const delta = event.clientX - drag.startX
    if (!drag.moved && Math.abs(delta) <= 6) return
    drag.moved = true
    setOffset(drag.origin - delta)
  }

  const endDrag = (event) => {
    const drag = dragRef.current
    if (!drag.active) return
    drag.active = false
    setDragging(false)
    // The browser releases pointer capture after pointerup or pointercancel.

    const track = trackRef.current
    const loopWidth = (track?.scrollWidth || 0) / 2
    if (loopWidth > 0) {
      setOffset((value) => {
        let next = value
        while (next <= -loopWidth) next += loopWidth
        while (next > 0) next -= loopWidth
        return next
      })
    }


  }

  if (!items.length) return null

  return (
    <section className="showcase-section" aria-labelledby="featured-electronics-title">
      <div className="showcase-section__glow" aria-hidden="true" />
      <div className="container-shell relative">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6 sm:mb-8">
          <div className="min-w-0 max-w-2xl">
            <p className="text-volt font-semibold tracking-[0.18em] uppercase text-[11px] sm:text-xs mb-2">
              Showcase
            </p>
            <h2 id="featured-electronics-title" className="page-title text-snow">
              Featured Electronics
            </h2>
            <p className="mt-2 text-sm sm:text-base text-silver/80 leading-relaxed">
              Explore premium Apple devices and accessories in a smooth interactive showcase.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="showcase-nav-btn"
              aria-label="Scroll showcase left"
              onClick={() => nudge(-1)}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="showcase-nav-btn"
              aria-label="Scroll showcase right"
              onClick={() => nudge(1)}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div
        className={`showcase-viewport${dragging ? ' is-dragging' : ''}`}
        onClickCapture={event => {
          if (event.detail && dragRef.current.moved) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          ref={trackRef}
          className="showcase-track"
          style={{ '--showcase-nudge': `${-offset}px` }}
        >
          {loopItems.map((product, index) => (
            <ShowcaseCard key={`${product.id}-${index}`} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Expand, Minimize2, ZoomIn, ZoomOut, RotateCcw, Images } from 'lucide-react'

/**
 * Interactive product media:
 * - 360° drag/touch when product.viewerFrames has enough real frames
 * - Otherwise a multi-image gallery (no fake spin of a single photo)
 */
export default function ProductViewer({
  product,
  activeImage,
  alt = '',
}) {
  const frames360 = useMemo(() => {
    const frames = product?.viewerFrames
    return Array.isArray(frames) && frames.length >= 8 ? frames.filter(Boolean) : []
  }, [product])

  const gallery = useMemo(() => {
    const set = new Set()
    if (activeImage) set.add(activeImage)
    ;(product?.images || []).forEach((src) => src && set.add(src))
    if (product?.image) set.add(product.image)
    Object.values(product?.colorImages || {}).forEach((src) => src && set.add(src))
    return Array.from(set)
  }, [product, activeImage])

  const is360 = frames360.length >= 8
  const sources = is360 ? frames360 : gallery

  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const dragRef = useRef({ active: false, lastX: 0 })
  const stageRef = useRef(null)

  useEffect(() => {
    if (!is360 && activeImage) {
      const i = gallery.indexOf(activeImage)
      setIndex(i >= 0 ? i : 0)
    }
  }, [activeImage, gallery, is360])

  useEffect(() => {
    setZoom(1)
  }, [index, activeImage, product?.id])

  const current = sources[Math.min(index, Math.max(0, sources.length - 1))] || activeImage || product?.image

  const stepFrame = useCallback(
    (delta) => {
      if (!sources.length) return
      setIndex((i) => (i + delta + sources.length) % sources.length)
    },
    [sources.length]
  )

  const onPointerDown = (e) => {
    if (zoom > 1 && !is360) return
    dragRef.current = { active: true, lastX: e.clientX }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.lastX
    if (Math.abs(dx) < 12) return
    dragRef.current.lastX = e.clientX
    if (is360) {
      stepFrame(dx > 0 ? -1 : 1)
    } else if (sources.length > 1) {
      stepFrame(dx > 0 ? -1 : 1)
    }
  }

  const onPointerUp = () => {
    dragRef.current.active = false
  }

  const toggleFullscreen = async () => {
    const el = stageRef.current
    if (!el) return
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen?.()
        setFullscreen(true)
      } else {
        await document.exitFullscreen?.()
        setFullscreen(false)
      }
    } catch {
      setFullscreen((v) => !v)
    }
  }

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  return (
    <div
      ref={stageRef}
      className={`relative flex flex-col min-w-0 ${
        fullscreen ? 'bg-ink text-snow p-4' : ''
      }`}
    >
      <div
        className="product-media relative aspect-square overflow-hidden bg-gradient-to-b from-silver/10 to-transparent dark:from-ink/40 select-none touch-pan-y"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label={alt || product?.name || 'Product media'}
      >
        <img
          key={current}
          src={current}
          alt={alt || product?.name || ''}
          draggable={false}
          className="h-full w-full object-contain p-5 sm:p-8 transition-transform duration-150"
          style={{ transform: `scale(${zoom})` }}
        />

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-ink/80 text-snow text-[10px] font-bold uppercase tracking-wider px-2.5 py-1">
            {is360 ? '360° viewer' : 'Gallery'}
          </span>
          {sources.length > 1 ? (
            <span className="rounded-full bg-white/80 dark:bg-graphite/80 text-[10px] font-semibold px-2.5 py-1">
              {index + 1}/{sources.length}
            </span>
          ) : null}
        </div>

        <div className="absolute top-3 right-3 flex gap-1.5">
          <button
            type="button"
            className="rounded-full bg-white/85 dark:bg-ink/80 p-2 hover:bg-volt hover:text-ink transition"
            onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="rounded-full bg-white/85 dark:bg-ink/80 p-2 hover:bg-volt hover:text-ink transition"
            onClick={() => setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="rounded-full bg-white/85 dark:bg-ink/80 p-2 hover:bg-volt hover:text-ink transition"
            onClick={() => setZoom(1)}
            aria-label="Reset zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="rounded-full bg-white/85 dark:bg-ink/80 p-2 hover:bg-volt hover:text-ink transition"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
          </button>
        </div>

        {sources.length > 1 ? (
          <p className="absolute bottom-3 left-0 right-0 text-center text-[11px] text-muted pointer-events-none">
            {is360 ? 'Drag or swipe to rotate' : 'Drag or swipe for more angles'}
          </p>
        ) : null}
      </div>

      {sources.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto p-3 scrollbar-thin">
          {sources.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              className={`shrink-0 h-14 w-14 rounded-[12px] border overflow-hidden bg-silver/10 ${
                i === index ? 'border-volt' : 'border-silver/25'
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <img src={src} alt="" className="h-full w-full object-contain p-1" />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted">
          <Images className="w-3.5 h-3.5" />
          Single angle available — 360° appears when multi-frame assets are provided.
        </div>
      )}
    </div>
  )
}

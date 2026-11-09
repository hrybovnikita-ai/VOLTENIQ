import { useEffect, useMemo, useState } from 'react'

export const PRICE_PRESETS = [
  { id: 'under-500', label: 'Under $500', min: '', max: '499' },
  { id: '500-1000', label: '$500–$1,000', min: '500', max: '1000' },
  { id: '1000-2000', label: '$1,000–$2,000', min: '1000', max: '2000' },
  { id: '2000-3000', label: '$2,000–$3,000', min: '2000', max: '3000' },
  { id: '3000-plus', label: '$3,000+', min: '3000', max: '' },
]

const SLIDER_MAX = 5000
const SLIDER_MIN = 0
const SLIDER_STEP = 50

function toNumber(value, fallback) {
  if (value === '' || value == null) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Catalog USD price filter: min/max inputs, dual-range slider, quick presets.
 * All values are DEMO filter bounds — backend remains the price source of truth.
 */
export default function PriceRangeFilter({ minPrice, maxPrice, onChange }) {
  const [draftMin, setDraftMin] = useState(minPrice ?? '')
  const [draftMax, setDraftMax] = useState(maxPrice ?? '')

  useEffect(() => {
    setDraftMin(minPrice ?? '')
    setDraftMax(maxPrice ?? '')
  }, [minPrice, maxPrice])

  const sliderMin = toNumber(minPrice, SLIDER_MIN)
  const sliderMax = toNumber(maxPrice, SLIDER_MAX)

  const activePreset = useMemo(() => {
    return (
      PRICE_PRESETS.find(
        (p) => String(p.min) === String(minPrice || '') && String(p.max) === String(maxPrice || '')
      )?.id || null
    )
  }, [minPrice, maxPrice])

  const commit = (nextMin, nextMax) => {
    let lo = nextMin
    let hi = nextMax
    const loN = toNumber(lo, null)
    const hiN = toNumber(hi, null)
    if (loN != null && hiN != null && loN > hiN) {
      lo = String(hiN)
      hi = String(loN)
    }
    onChange({
      minPrice: lo === '' || lo == null ? '' : String(Math.max(0, Math.round(Number(lo)))),
      maxPrice: hi === '' || hi == null ? '' : String(Math.max(0, Math.round(Number(hi)))),
    })
  }

  const onSliderMin = (value) => {
    const next = Math.min(Number(value), sliderMax - SLIDER_STEP)
    commit(String(next), maxPrice || '')
  }

  const onSliderMax = (value) => {
    const next = Math.max(Number(value), sliderMin + SLIDER_STEP)
    commit(minPrice || '', String(next >= SLIDER_MAX ? '' : next))
  }

  const fillLeft = (sliderMin / SLIDER_MAX) * 100
  const fillRight = (sliderMax / SLIDER_MAX) * 100

  return (
    <section className="glass glass-panel rounded-[16px] p-4 sm:p-5 mb-5 sm:mb-6">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold">Price Range</h2>
          <p className="text-xs text-muted mt-1">Demo USD filters · not official pricing</p>
        </div>
        <span className="text-sm text-muted font-medium">USD</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <label className="block min-w-0">
          <span className="block text-xs font-medium mb-1.5 text-muted">Min Price ($)</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={draftMin}
            placeholder="0"
            onChange={(e) => setDraftMin(e.target.value)}
            onBlur={() => commit(draftMin, draftMax)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit(draftMin, draftMax)
            }}
            className="glass-input w-full rounded-full px-4 py-2.5 text-sm"
          />
        </label>
        <label className="block min-w-0">
          <span className="block text-xs font-medium mb-1.5 text-muted">Max Price ($)</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={draftMax}
            placeholder="Any"
            onChange={(e) => setDraftMax(e.target.value)}
            onBlur={() => commit(draftMin, draftMax)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit(draftMin, draftMax)
            }}
            className="glass-input w-full rounded-full px-4 py-2.5 text-sm"
          />
        </label>
      </div>

      <div className="relative h-8 mb-4 px-1">
        <div className="absolute left-1 right-1 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-silver/25" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-volt/80"
          style={{ left: `calc(${fillLeft}% + 4px)`, right: `calc(${100 - fillRight}% + 4px)` }}
        />
        <input
          type="range"
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={SLIDER_STEP}
          value={sliderMin}
          onChange={(e) => onSliderMin(e.target.value)}
          className="price-range-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto"
          aria-label="Minimum demo price"
        />
        <input
          type="range"
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={SLIDER_STEP}
          value={sliderMax}
          onChange={(e) => onSliderMax(e.target.value)}
          className="price-range-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto"
          aria-label="Maximum demo price"
        />
      </div>

      <div className="chip-row">
        {PRICE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => commit(preset.min, preset.max)}
            className={`rounded-full px-3.5 py-2 text-xs sm:text-sm font-medium border transition min-h-10 ${
              activePreset === preset.id
                ? 'bg-volt text-ink border-volt'
                : 'border-silver/30 hover:border-volt'
            }`}
          >
            {preset.label}
          </button>
        ))}
        {(minPrice || maxPrice) && (
          <button
            type="button"
            onClick={() => commit('', '')}
            className="rounded-full px-3.5 py-2 text-xs sm:text-sm font-medium border border-silver/30 text-muted hover:border-volt hover:text-volt min-h-10"
          >
            Clear
          </button>
        )}
      </div>
    </section>
  )
}

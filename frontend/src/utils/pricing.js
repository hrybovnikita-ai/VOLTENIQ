/**
 * Demo variant pricing driven entirely by product.variantPricing from the API.
 * - absolute.* : first matching key in ABSOLUTE_PRIORITY becomes the unit base
 * - add.*      : every matching add-on is summed once
 * Quantity is applied separately: total = unit × qty
 */

export const PLACEHOLDER_IMAGE = '/products/placeholder-phone.svg'

const ABSOLUTE_PRIORITY = [
  'storage',
  'size',
  'chip',
  'model',
  'case',
  'connectivity',
]

function optionDefs(product) {
  if (Array.isArray(product?.options) && product.options.length) {
    return product.options.filter((o) => o?.key && Array.isArray(o.values) && o.values.length)
  }
  // Legacy fallback if options[] is missing
  const legacy = []
  if (product?.colors?.length) legacy.push({ key: 'color', label: 'Color', values: product.colors })
  if (product?.storage?.length) legacy.push({ key: 'storage', label: 'Storage', values: product.storage })
  if (product?.ram?.length) legacy.push({ key: 'ram', label: 'Memory', values: product.ram })
  if (product?.size?.length) legacy.push({ key: 'size', label: 'Size', values: product.size })
  return legacy
}

export function getProductOptions(product) {
  return optionDefs(product)
}

export function getUnitPrice(product, selections = {}) {
  if (!product) return 0

  const pricing = product.variantPricing || {}
  const absolute = pricing.absolute || {}
  const add = pricing.add || {}

  let unit = Number(product.price) || 0
  let usedAbsolute = false

  for (const key of ABSOLUTE_PRIORITY) {
    const selected = selections[key]
    if (selected != null && absolute[key]?.[selected] != null) {
      unit = Number(absolute[key][selected])
      usedAbsolute = true
      break
    }
  }

  // Any other absolute maps not in priority (defensive)
  if (!usedAbsolute) {
    for (const [key, table] of Object.entries(absolute)) {
      const selected = selections[key]
      if (selected != null && table?.[selected] != null) {
        unit = Number(table[selected])
        break
      }
    }
  }

  for (const [key, table] of Object.entries(add)) {
    const selected = selections[key]
    if (selected != null && table?.[selected] != null) {
      // Skip size add-on when size already set the absolute base
      if (key === 'size' && usedAbsolute && absolute.size?.[selected] != null) continue
      if (key === 'storage' && absolute.storage?.[selected] != null) continue
      unit += Number(table[selected])
    }
  }

  return Math.round(unit * 100) / 100
}

export function getLineTotal(unitPrice, quantity) {
  const qty = Math.max(1, Number(quantity) || 1)
  return Math.round(Number(unitPrice) * qty * 100) / 100
}

export function clampQuantity(quantity, stock = Infinity) {
  const max = Math.max(1, Number(stock) || 1)
  const qty = Number(quantity)
  if (!Number.isFinite(qty)) return 1
  return Math.min(max, Math.max(1, Math.floor(qty)))
}

export function defaultSelections(product) {
  const selections = {}
  for (const opt of optionDefs(product)) {
    selections[opt.key] = opt.values[0] ?? null
  }
  return selections
}

export function formatVariantLabel(selections = {}, product) {
  const opts = product ? optionDefs(product) : null
  if (opts?.length) {
    return opts
      .map((o) => selections[o.key])
      .filter(Boolean)
      .join(' · ')
  }
  return Object.values(selections || {})
    .filter((v) => v != null && v !== '')
    .join(' · ')
}

export function selectionKey(productId, selections = {}) {
  const keys = Object.keys(selections).sort()
  return [productId, ...keys.map((k) => `${k}=${selections[k] ?? ''}`)].join('::')
}

/**
 * Resolve display image for the current configuration.
 * Color / model / case maps never fall back to a different variant's photo —
 * missing entries use the placeholder.
 */
export function getVariantImage(product, colorOrSelections) {
  if (!product) return PLACEHOLDER_IMAGE

  const selections =
    colorOrSelections != null && typeof colorOrSelections === 'object'
      ? colorOrSelections
      : { color: colorOrSelections || null }

  const variantImages = product.variantImages || {}
  const colorMap = product.colorImages || variantImages.color || null

  // Size / model first so MacBook 13/14/15/16 photos swap with the Display option
  for (const key of ['size', 'model', 'case', 'band']) {
    const map = variantImages[key]
    const value = selections[key]
    if (map && value && map[value]) {
      return map[value]
    }
  }

  // Exact color match when available; never reuse another finish
  if (colorMap && typeof colorMap === 'object' && selections.color) {
    return colorMap[selections.color] || PLACEHOLDER_IMAGE
  }

  if (variantImages.chip && selections.chip && variantImages.chip[selections.chip]) {
    return variantImages.chip[selections.chip]
  }

  return product.image || PLACEHOLDER_IMAGE
}

/** Build price hint labels for an option group from variantPricing */
export function getOptionPriceHints(product, optionKey, formatPrice) {
  if (!product || !optionKey) return {}
  const absolute = product.variantPricing?.absolute?.[optionKey] || {}
  const add = product.variantPricing?.add?.[optionKey] || {}
  const hints = {}

  for (const [value, price] of Object.entries(absolute)) {
    hints[value] = formatPrice(price)
  }
  for (const [value, delta] of Object.entries(add)) {
    if (hints[value] != null) continue
    const n = Number(delta) || 0
    hints[value] = n > 0 ? `+${formatPrice(n)}` : n < 0 ? `−${formatPrice(Math.abs(n))}` : ''
  }
  return hints
}

const variants = [
  'color',
  'storage',
  'ram',
  'size',
  'chip',
  'connectivity',
  'material',
  'band',
  'model',
  'case',
  'compatible',
  'layout',
]
export const cartSelections = (item) =>
  Object.fromEntries(variants.filter((key) => item[key]).map((key) => [key, item[key]]))


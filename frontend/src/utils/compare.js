/** Build comparable specification rows from real product fields only. */

export const COMPARE_ROWS = [
  { key: 'price', label: 'Demo price' },
  { key: 'display', label: 'Display' },
  { key: 'chip', label: 'Chip' },
  { key: 'camera', label: 'Camera' },
  { key: 'battery', label: 'Battery' },
  { key: 'ram', label: 'RAM' },
  { key: 'storage', label: 'Storage' },
  { key: 'colors', label: 'Colors' },
  { key: 'category', label: 'Category' },
  { key: 'rating', label: 'Rating' },
  { key: 'stock', label: 'Availability' },
]

function joinList(values, fallback = '—') {
  if (!Array.isArray(values) || !values.length) return fallback
  return values.join(', ')
}

export function getCompareValue(product, key) {
  if (!product) return '—'
  switch (key) {
    case 'price':
      return Number(product.price) || 0
    case 'display':
      return (
        joinList(product.size, null) ||
        product.specs?.sizes ||
        product.specs?.display ||
        product.specs?.form ||
        '—'
      )
    case 'chip':
      return joinList(product.chip, null) || product.specs?.chip || product.specs?.family || '—'
    case 'camera':
      return product.specs?.camera || '—'
    case 'battery':
      return product.specs?.battery || '—'
    case 'ram':
      return joinList(product.ram, null) || product.specs?.ram || '—'
    case 'storage':
      return joinList(product.storage)
    case 'colors':
      return joinList(product.colors)
    case 'category':
      return product.category || '—'
    case 'rating':
      return product.rating != null ? Number(product.rating) : '—'
    case 'stock':
      return Number(product.stock) > 0 ? `In stock (${product.stock})` : 'Sold out'
    default:
      return product.specs?.[key] || '—'
  }
}

export function valuesDiffer(products, key) {
  if (!products?.length || products.length < 2) return false
  const values = products.map((p) => String(getCompareValue(p, key)))
  return new Set(values).size > 1
}

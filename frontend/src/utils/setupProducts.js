const audio = ['airpods-pro', 'airpods']
const desk = ['magic-mouse', 'magic-keyboard', 'magic-trackpad']
const families = {
  iPhone: audio,
  iPad: ['magic-keyboard', ...audio],
  MacBook: desk,
  iMac: desk,
  'Mac Studio': desk,
  'Mac Pro': desk,
  AirPods: ['iphone-16-pro', 'ipad-air', 'macbook-air'],
  Headphones: ['iphone-16-pro', 'ipad-air', 'macbook-air'],
  'Apple Watch': ['iphone-16-pro', 'airpods-pro'],
  Accessories: ['macbook-air', 'mac-studio'],
}

export function setupProducts(product, catalog) {
  return (families[product.category] || []).map(slug => catalog.find(item =>
    item.slug === slug && item.id !== product.id && item.stock > 0)).filter(Boolean)
}

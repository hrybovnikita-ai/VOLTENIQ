/** Approximate finish chips for demo color pickers */
const SWATCHES = {
  'Ice Blue': '#c2cfe0',
  Burgundy: '#64333f',
  Purple: '#b7a0d9',
  'Deep Purple': '#5c2a3a',
  'Space Gray': '#4a4d51',
  'Sky Blue': '#7eb6d4',
  Silver: '#e4e4e8',
  Gold: '#f2d6a4',
  Graphite: '#52534d',
  'Sierra Blue': '#a7c1d9',
  'Alpine Green': '#576856',
  Pink: '#e8b4a8',
  Orange: '#e28a5a',
  White: '#f5f5f7',
  Midnight: '#1c1c1e',
  Starlight: '#f0e4d3',
  'Space Black': '#1d1d1f',
  Blue: '#3b82c4',
  Green: '#a8c686',
  Yellow: '#f5d76e',
  Red: '#bf2e2e',
  Black: '#111111',
}

export function swatchColor(name) {
  return SWATCHES[name] || '#9ca3af'
}

export function isLightSwatch(name) {
  const hex = swatchColor(name).replace('#', '')
  if (hex.length !== 6) return false
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 170
}

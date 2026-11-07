export function formatPrice(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

/** One decimal place without float noise (e.g. 4.9, not 4.8999999999999995). */
export function formatRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

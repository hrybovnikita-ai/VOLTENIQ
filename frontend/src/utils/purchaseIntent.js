const KEY = 'volteniq_purchase_intent'
const REDIRECT_KEY = 'volteniq_auth_redirect'

export function savePurchaseIntent(intent) {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({
      ...intent,
      createdAt: Date.now(),
    })
  )
}

export function loadPurchaseIntent() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    // Expire after 2 hours
    if (data.createdAt && Date.now() - data.createdAt > 2 * 60 * 60 * 1000) {
      clearPurchaseIntent()
      return null
    }
    return data
  } catch {
    return null
  }
}

export function clearPurchaseIntent() {
  sessionStorage.removeItem(KEY)
}

export function saveAuthRedirect(path) {
  sessionStorage.setItem(REDIRECT_KEY, path || '/checkout')
}

export function consumeAuthRedirect(fallback = '/profile') {
  const path = sessionStorage.getItem(REDIRECT_KEY)
  sessionStorage.removeItem(REDIRECT_KEY)
  if (path) return path
  const intent = loadPurchaseIntent()
  if (intent) return '/checkout'
  return fallback
}

/**
 * Start checkout for Buy Now or cart.
 * Authenticated users go to /checkout; others to /signup with redirect preserved.
 */
export function beginCheckout({ isAuthenticated, navigate, intent }) {
  savePurchaseIntent(intent)
  saveAuthRedirect('/checkout')
  if (isAuthenticated) {
    navigate('/checkout')
    return
  }
  navigate('/login', { state: { from: '/checkout' } })
}

const KEY = 'volteniq_purchase_intent'

// sessionStorage throws in some in-app WebViews and locked-down privacy modes.
const session = {
  getItem(key) {
    try { return window.sessionStorage.getItem(key) } catch { return null }
  },
  setItem(key, value) {
    try { window.sessionStorage.setItem(key, value) } catch { /* optional */ }
  },
  removeItem(key) {
    try { window.sessionStorage.removeItem(key) } catch { /* optional */ }
  },
}
const REDIRECT_KEY = 'volteniq_auth_redirect'

export function savePurchaseIntent(intent) {
  session.setItem(
    KEY,
    JSON.stringify({
      ...intent,
      createdAt: Date.now(),
    })
  )
}

export function loadPurchaseIntent() {
  try {
    const raw = session.getItem(KEY)
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
  session.removeItem(KEY)
}

export function saveAuthRedirect(path) {
  session.setItem(REDIRECT_KEY, path || '/checkout')
}

/** Read the saved post-login destination without clearing it. */
export function peekAuthRedirect() {
  return session.getItem(REDIRECT_KEY)
}

export function clearAuthRedirect() {
  session.removeItem(REDIRECT_KEY)
}

export function consumeAuthRedirect(fallback = '/profile') {
  const path = session.getItem(REDIRECT_KEY)
  session.removeItem(REDIRECT_KEY)
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

// Store sign-out that cannot get stuck.
//
// Every step is bounded by a timeout and isolated from the others, so a hung
// Firebase/Clerk call (seen in iOS WKWebViews such as Telegram) or an offline
// API never leaves the shopper looking signed in. The page is always
// hard-navigated to /login at the end, which drops in-memory React state.

export const SIGNED_OUT_PATH = '/login?signedOut=1'

// Set before the server call and cleared once the server confirms. If the
// request never lands (offline, tab killed), the next page load retries the
// logout before restoring the cookie session instead of signing them back in.
export const PENDING_LOGOUT_KEY = 'volteniq_pending_logout'

const LOCAL_AUTH_KEYS = [
  'volteniq_token',
  'volteniq_user',
  // The signed-in bag is saved server-side; do not leave it behind for the
  // next person on a shared device.
  'volteniq_cart',
]
const LOCAL_AUTH_PREFIXES = ['firebase:authUser:', 'firebase:redirectUser:', '__clerk', 'volteniq:purchase:']
const SESSION_AUTH_KEYS = [
  'volteniq_google_redirect',
  'volteniq_auth_redirect',
  'volteniq_purchase_intent',
]
const SESSION_AUTH_PREFIXES = ['firebase:pendingRedirect:', 'firebase:authUser:', '__clerk']

function storageArea(name) {
  try {
    return typeof window !== 'undefined' ? window[name] : null
  } catch {
    return null
  }
}

function scrub(area, keys, prefixes) {
  if (!area) return
  try {
    for (const key of keys) area.removeItem(key)
    const doomed = []
    for (let i = 0; i < area.length; i += 1) {
      const key = area.key(i)
      if (key && prefixes.some((prefix) => key.startsWith(prefix))) doomed.push(key)
    }
    for (const key of doomed) area.removeItem(key)
  } catch {
    // Storage can throw in private modes and embedded browsers.
  }
}

/** Remove client-side auth leftovers. Never touches theme/compare/favorites. */
export function clearAuthStorage({
  local = storageArea('localStorage'),
  session = storageArea('sessionStorage'),
} = {}) {
  scrub(local, LOCAL_AUTH_KEYS, LOCAL_AUTH_PREFIXES)
  scrub(session, SESSION_AUTH_KEYS, SESSION_AUTH_PREFIXES)
}

export function markLogoutPending(local = storageArea('localStorage')) {
  try { local?.setItem(PENDING_LOGOUT_KEY, String(Date.now())) } catch { /* optional */ }
}

export function clearLogoutPending(local = storageArea('localStorage')) {
  try { local?.removeItem(PENDING_LOGOUT_KEY) } catch { /* optional */ }
}

export function isLogoutPending(local = storageArea('localStorage')) {
  try { return Boolean(local?.getItem(PENDING_LOGOUT_KEY)) } catch { return false }
}

/** Resolve/reject like `task()`, or reject after `ms`. Sync throws reject. */
export function withTimeout(task, ms, label = 'operation') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`${label} timed out`)
      error.code = 'timeout'
      reject(error)
    }, ms)
    Promise.resolve()
      .then(task)
      .then(
        (value) => { clearTimeout(timer); resolve(value) },
        (error) => { clearTimeout(timer); reject(error) }
      )
  })
}

export function defaultRedirect(path = SIGNED_OUT_PATH) {
  if (typeof window === 'undefined') return
  try {
    window.location.replace(path)
  } catch {
    window.location.href = path
  }
}

async function revokeServerSession(serverLogout, { timeoutMs, attempts }) {
  let lastError = null
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await withTimeout(serverLogout, timeoutMs, 'server logout')
      return { ok: true }
    } catch (error) {
      lastError = error
      // Only retry fast failures (dropped connection, 5xx). A timeout already
      // used the whole budget, and most 4xx will not get better.
      if (error?.code === 'timeout') break
      const status = Number(error?.status) || 0
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) break
    }
  }
  return { ok: false, error: lastError }
}

let inFlight = null

/**
 * Sign the shopper out everywhere and leave the page.
 *
 * @param {object} options
 * @param {() => Promise<unknown>} options.serverLogout POST /api/auth/logout
 * @param {Array<() => Promise<unknown>>} [options.providers] Firebase / Clerk sign-outs
 * @param {() => void} [options.clearState] drop the React user immediately
 * @param {(path: string) => void} [options.redirect] defaults to location.replace
 * @returns {Promise<{ server: 'ok' | 'failed', providers: string[] }>}
 *   Never rejects. Concurrent calls share one run (double taps).
 */
export function performSignOut(options) {
  if (inFlight) return inFlight
  inFlight = runSignOut(options).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function runSignOut({
  serverLogout,
  providers = [],
  clearState = () => {},
  redirect = defaultRedirect,
  redirectTo = SIGNED_OUT_PATH,
  local = storageArea('localStorage'),
  session = storageArea('sessionStorage'),
  timeoutMs = 6000,
  providerTimeoutMs = 3000,
  attempts = 2,
}) {
  const outcome = { server: 'failed', providers: [] }
  try {
    markLogoutPending(local)
    try { clearState() } catch { /* UI state is rebuilt by the redirect */ }

    // Server first: a provider (Clerk) may navigate the page, which would
    // abort an in-flight logout request.
    const server = await revokeServerSession(serverLogout, { timeoutMs, attempts })
    outcome.server = server.ok ? 'ok' : 'failed'
    if (server.ok) clearLogoutPending(local)

    outcome.providers = await Promise.all(providers.map((signOut, index) => (
      withTimeout(signOut, providerTimeoutMs, `provider ${index}`)
        .then(() => 'ok', (error) => (error?.code === 'timeout' ? 'timeout' : 'failed'))
    )))
  } catch {
    // Fall through: the redirect below must always run.
  } finally {
    clearAuthStorage({ local, session })
    try { redirect(redirectTo) } catch { /* nothing else to do */ }
  }
  return outcome
}

/**
 * Restore the cookie session on page load, finishing an interrupted sign-out
 * first so a refresh can never sign the shopper back in.
 * Resolves to the user or null; rejects only if `restore` rejects.
 */
export async function restoreStoreSession({
  logout,
  restore,
  local = storageArea('localStorage'),
  timeoutMs = 6000,
}) {
  if (isLogoutPending(local)) {
    try {
      await withTimeout(logout, timeoutMs, 'pending logout')
      clearLogoutPending(local)
    } catch {
      // Still could not reach the server: stay signed out on this device and
      // retry on the next load. Signing in again clears the marker.
      return null
    }
  }
  return restore()
}

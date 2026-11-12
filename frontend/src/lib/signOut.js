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
  // Hard cap from tap to redirect. Retries and provider calls can otherwise
  // add up to ~15 s on a flaky tablet/WebView connection, which reads as
  // "Sign Out does nothing". The logout request is sent with keepalive, and
  // the pending marker makes the next page load finish it if it was cut off.
  deadlineMs = 5000,
}) {
  const outcome = { server: 'failed', providers: [], deadline: false }
  let deadlineTimer = null
  try {
    markLogoutPending(local)
    try { clearState() } catch { /* UI state is rebuilt by the redirect */ }

    const work = (async () => {
      // Server first: a provider (Clerk) may navigate the page, which would
      // abort an in-flight logout request.
      const server = await revokeServerSession(serverLogout, { timeoutMs, attempts })
      outcome.server = server.ok ? 'ok' : 'failed'
      if (server.ok) clearLogoutPending(local)

      outcome.providers = await Promise.all(providers.map((signOut, index) => (
        withTimeout(signOut, providerTimeoutMs, `provider ${index}`)
          .then(() => 'ok', (error) => (error?.code === 'timeout' ? 'timeout' : 'failed'))
      )))
    })()
    const deadline = new Promise((resolve) => {
      deadlineTimer = setTimeout(() => { outcome.deadline = true; resolve() }, deadlineMs)
    })
    await Promise.race([work, deadline])
  } catch {
    // Fall through: the redirect below must always run.
  } finally {
    clearTimeout(deadlineTimer)
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

/**
 * Run `callback` when the browser restores this page from the back/forward
 * cache (iOS Safari, Telegram's WKWebView and Chrome all do this). A restored
 * page keeps its old in-memory React state, so it can show a user who has
 * since signed out, or a Sign Out button stuck on "Signing out…".
 * @returns {() => void} detach
 */
export function onPageRestored(callback, win = typeof window !== 'undefined' ? window : undefined) {
  if (!win?.addEventListener) return () => {}
  const onPageShow = (event) => {
    if (event?.persisted) callback(event)
  }
  win.addEventListener('pageshow', onPageShow)
  return () => win.removeEventListener('pageshow', onPageShow)
}

/**
 * Busy state for a Sign Out button that can never get stuck.
 *
 * `trigger(task)` runs `task` (or the `run` option). Double taps start one run. Once the run settles the page should already be
 * leaving; if it is still here `settleMs` later (navigation blocked, slow
 * WebView, restored from bfcache), the button is enabled again so another tap
 * retries instead of doing nothing. `reset()` re-enables it immediately.
 */
export function createSignOutGuard({
  run,
  onBusyChange = () => {},
  settleMs = 4000,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
} = {}) {
  let busy = false
  let timer = null
  let generation = 0

  const reset = () => {
    generation += 1
    if (timer !== null) clearTimer(timer)
    timer = null
    if (busy) {
      busy = false
      onBusyChange(false)
    }
  }

  const trigger = (task = run) => {
    if (busy) return false
    busy = true
    const mine = ++generation
    onBusyChange(true)
    let pending
    try {
      pending = Promise.resolve(task())
    } catch (error) {
      pending = Promise.reject(error)
    }
    pending
      .catch(() => {})
      .then(() => {
        if (mine !== generation) return
        timer = setTimer(() => {
          timer = null
          if (mine === generation) reset()
        }, settleMs)
      })
    return true
  }

  return { trigger, reset, isBusy: () => busy }
}

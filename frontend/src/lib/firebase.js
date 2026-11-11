import { initializeApp, getApp, getApps } from 'firebase/app'
import {
  initializeAuth,
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  browserPopupRedirectResolver,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  GoogleAuthProvider,
} from 'firebase/auth'
import {
  canUseRedirect,
  currentEmbeddedBrowser,
  isPopupUnavailable,
  mapFirebaseAuthError,
  resolveAuthDomain,
  shouldPreferGoogleRedirect,
} from './firebaseAuthPolicy.js'

export { mapFirebaseAuthError, shouldPreferGoogleRedirect } from './firebaseAuthPolicy.js'

const env = import.meta.env || {}
const pageHost = typeof window !== 'undefined' ? window.location.host : ''
const pageProtocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  // Same-origin authDomain (via the /__/auth proxy) when this host is listed.
  authDomain: resolveAuthDomain({
    configured: env.VITE_FIREBASE_AUTH_DOMAIN,
    proxyHosts: env.VITE_FIREBASE_AUTH_PROXY_HOSTS,
    host: pageHost,
    protocol: pageProtocol,
  }),
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = ['apiKey', 'authDomain', 'projectId', 'appId'].every(
  (key) => firebaseConfig[key]
)

const REDIRECT_FLAG = 'volteniq_google_redirect'
const REDIRECT_FLAG_TTL_MS = 10 * 60 * 1000

function markRedirectPending() {
  try { window.sessionStorage.setItem(REDIRECT_FLAG, String(Date.now())) } catch { /* storage blocked */ }
}

function takeRedirectPending() {
  try {
    const raw = window.sessionStorage.getItem(REDIRECT_FLAG)
    window.sessionStorage.removeItem(REDIRECT_FLAG)
    return Boolean(raw) && Date.now() - Number(raw) < REDIRECT_FLAG_TTL_MS
  } catch {
    return false
  }
}

let auth

function getFirebaseAuth() {
  if (auth) return auth
  const app = getApps().some((entry) => entry.name === 'volteniq-google')
    ? getApp('volteniq-google')
    : initializeApp(firebaseConfig, 'volteniq-google')
  try {
    // Persistence is required for signInWithRedirect / getRedirectResult.
    // Firebase falls back down the list when IndexedDB/localStorage are
    // blocked (private modes, some WebViews). We sign out immediately after
    // minting an ID token so no long-lived Firebase session remains.
    auth = initializeAuth(app, {
      persistence: [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch {
    auth = getAuth(app)
  }
  return auth
}

function googleProvider() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return provider
}

async function idTokenFromUser(user) {
  const token = await user.getIdToken()
  await signOut(getFirebaseAuth()).catch(() => {})
  return token
}

function redirectSupported() {
  return canUseRedirect(firebaseConfig.authDomain, pageHost)
}

/**
 * Continue a Google redirect that returned to this origin.
 * Resolves to an ID token string, or null when no redirect is pending.
 * Rejects with a user-facing message when Google/Firebase reported an error.
 */
let pendingRedirect
export function consumeGoogleRedirectResult() {
  // StrictMode can mount twice. Both consumers need the same one-shot result.
  return pendingRedirect ??= readGoogleRedirectResult()
}

async function readGoogleRedirectResult() {
  // Only touch Firebase when this tab actually started a redirect; otherwise
  // every page load would pay for loading the auth iframe.
  if (!firebaseConfigured || !redirectSupported() || !takeRedirectPending()) return null
  try {
    const result = await getRedirectResult(getFirebaseAuth())
    if (!result?.user) return null
    return await idTokenFromUser(result.user)
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error), { cause: error })
  }
}

async function startRedirect(instance, provider) {
  markRedirectPending()
  await signInWithRedirect(instance, provider)
  return null
}

/**
 * Start Google sign-in. Returns a Firebase ID token, or null when a full-page
 * redirect was started (caller should leave the UI in a loading state).
 * Must be called synchronously from a click handler so popups are allowed.
 */
export async function googleIdToken() {
  if (!firebaseConfigured) {
    throw new Error('Google sign-in is unavailable. Use email and password.')
  }
  if (currentEmbeddedBrowser().embedded) {
    throw new Error(mapFirebaseAuthError({ code: 'auth/embedded-browser' }))
  }

  const instance = getFirebaseAuth()
  const provider = googleProvider()
  const canRedirect = redirectSupported()

  const preferRedirect = typeof navigator !== 'undefined'
    ? shouldPreferGoogleRedirect(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
    : false
  if (preferRedirect && canRedirect) return startRedirect(instance, provider)

  try {
    const result = await signInWithPopup(instance, provider)
    return await idTokenFromUser(result.user)
  } catch (error) {
    if (isPopupUnavailable(error) && canRedirect) return startRedirect(instance, provider)
    throw new Error(mapFirebaseAuthError(error), { cause: error })
  }
}

/** Best-effort: drop any Firebase browser state on store sign-out. */
export async function firebaseSignOut() {
  if (!firebaseConfigured || !auth) return
  await signOut(auth).catch(() => {})
}

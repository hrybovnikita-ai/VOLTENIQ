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
  GoogleAuthProvider,
} from 'firebase/auth'
import { mapFirebaseAuthError, shouldPreferGoogleRedirect } from './firebaseAuthPolicy.js'

export { mapFirebaseAuthError, shouldPreferGoogleRedirect } from './firebaseAuthPolicy.js'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = ['apiKey', 'authDomain', 'projectId', 'appId'].every(
  (key) => firebaseConfig[key]
)

let auth

function getFirebaseAuth() {
  if (auth) return auth
  const app = getApps().some((entry) => entry.name === 'volteniq-google')
    ? getApp('volteniq-google')
    : initializeApp(firebaseConfig, 'volteniq-google')
  try {
    // Local persistence is required for signInWithRedirect / getRedirectResult
    // (Safari, iOS, and popup-blocked desktop). We sign out immediately after
    // minting an ID token so Firebase does not keep a long-lived browser session.
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence,
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

function isPopupFailure(error) {
  return [
    'auth/popup-blocked',
    'auth/popup-closed-by-user',
    'auth/cancelled-popup-request',
  ].includes(error?.code)
}

async function idTokenFromUser(user) {
  const token = await user.getIdToken()
  await signOut(getFirebaseAuth()).catch(() => {})
  return token
}

/**
 * Continue a Google redirect that returned to this origin.
 * Returns an ID token string, or null when no redirect is pending.
 */
export async function consumeGoogleRedirectResult() {
  if (!firebaseConfigured) return null
  const result = await getRedirectResult(getFirebaseAuth())
  if (!result?.user) return null
  return idTokenFromUser(result.user)
}

/**
 * Start Google sign-in. Returns a Firebase ID token, or null when a full-page
 * redirect was started (caller should leave the UI in a loading state).
 */
export async function googleIdToken() {
  if (!firebaseConfigured) {
    throw new Error('Google sign-in is unavailable. Use email and password.')
  }

  const instance = getFirebaseAuth()
  const provider = googleProvider()

  const preferRedirect = typeof navigator !== 'undefined'
    ? shouldPreferGoogleRedirect(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
    : false
  if (preferRedirect) {
    await signInWithRedirect(instance, provider)
    return null
  }

  try {
    const result = await signInWithPopup(instance, provider)
    return idTokenFromUser(result.user)
  } catch (error) {
    if (isPopupFailure(error)) {
      await signInWithRedirect(instance, provider)
      return null
    }
    throw new Error(mapFirebaseAuthError(error))
  }
}

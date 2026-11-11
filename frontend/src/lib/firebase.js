import { initializeApp } from 'firebase/app'
import {
  initializeAuth, signInWithPopup, signOut,
  browserPopupRedirectResolver,
  inMemoryPersistence,
  GoogleAuthProvider,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = ['apiKey', 'authDomain', 'projectId', 'appId'].every(key => firebaseConfig[key])
let auth
export async function googleIdToken() {
  if (!firebaseConfigured) throw new Error('Google sign-in is unavailable. Use email and password.')
  auth ??= initializeAuth(initializeApp(firebaseConfig, 'volteniq-google'), {
    persistence: inMemoryPersistence, popupRedirectResolver: browserPopupRedirectResolver,
  })
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    const result = await signInWithPopup(auth, provider)
    return await result.user.getIdToken()
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error))
  } finally {
    await signOut(auth)
  }
}

export function mapFirebaseAuthError(error) {
  const code = error?.code || ''
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/user-disabled':
      return 'This account has been disabled.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Invalid email or password.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.'
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.'
    case 'auth/popup-blocked':
      return 'Pop-up blocked. Allow pop-ups for this site and try again.'
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.'
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase.'
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Firebase Auth. Authorize this storefront domain in Firebase Authentication.'
    default:
      return error?.message || 'Authentication failed.'
  }
}

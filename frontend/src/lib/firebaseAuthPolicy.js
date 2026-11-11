/** Prefer redirect on iOS/iPadOS Safari and other browsers that block OAuth popups. */
export function shouldPreferGoogleRedirect(
  userAgent = '',
  platform = '',
  maxTouchPoints = 0
) {
  const ua = String(userAgent || '')
  const isIOS = /iPad|iPhone|iPod/i.test(ua)
    || (platform === 'MacIntel' && Number(maxTouchPoints) > 1)
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|Firefox|FxiOS|OPR|Opera/i.test(ua)
  const isAndroidWebView = /\bwv\b|; wv\)/i.test(ua)
  return Boolean(isIOS || isSafari || isAndroidWebView)
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

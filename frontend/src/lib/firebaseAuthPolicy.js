// Pure browser/auth policy helpers. No Firebase imports so they run under node:test.

const IOS_RE = /iPad|iPhone|iPod/i

function isIOSDevice(ua, platform, maxTouchPoints) {
  return IOS_RE.test(ua) || (platform === 'MacIntel' && Number(maxTouchPoints) > 1)
}

/**
 * Detect in-app browsers / WebViews where Google refuses OAuth
 * (Error 403: disallowed_useragent) or where popups never open.
 * Telegram (chat links and Mini Apps), Instagram, Facebook, TikTok, LINE, etc.
 */
export function detectEmbeddedBrowser({
  userAgent = '',
  platform = '',
  maxTouchPoints = 0,
  hasTelegramProxy = false,
  hasTelegramWebApp = false,
  hash = '',
} = {}) {
  const ua = String(userAgent || '')
  const isAndroid = /Android/i.test(ua)
  const isIOS = isIOSDevice(ua, platform, maxTouchPoints)

  let app = null
  if (hasTelegramProxy || hasTelegramWebApp || /tgWebApp/i.test(hash) || /Telegram/i.test(ua)) app = 'telegram'
  else if (/Instagram/i.test(ua)) app = 'instagram'
  else if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua)) app = 'facebook'
  else if (/musical_ly|BytedanceWebview|TikTok|trill_/i.test(ua)) app = 'tiktok'
  else if (/\bLine\//i.test(ua)) app = 'line'
  else if (/Snapchat/i.test(ua)) app = 'snapchat'
  else if (/LinkedInApp/i.test(ua)) app = 'linkedin'
  else if (/MicroMessenger/i.test(ua)) app = 'wechat'
  else if (/Twitter|XApp/i.test(ua)) app = 'twitter'
  // Android System WebView marks itself with "; wv)".
  else if (isAndroid && /;\s*wv\)/i.test(ua)) app = 'webview'
  // iOS WKWebView omits the "Safari/" token that Safari, Chrome (CriOS),
  // Firefox (FxiOS) and Edge (EdgiOS) all send.
  else if (isIOS && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua)) app = 'webview'

  return {
    embedded: Boolean(app),
    app,
    platform: isIOS ? 'ios' : isAndroid ? 'android' : 'desktop',
  }
}

export function currentEmbeddedBrowser() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { embedded: false, app: null, platform: 'desktop' }
  }
  let hash = ''
  try { hash = window.location.hash || '' } catch { /* opaque origin */ }
  return detectEmbeddedBrowser({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    hasTelegramProxy: Boolean(window.TelegramWebviewProxy),
    hasTelegramWebApp: Boolean(window.Telegram?.WebApp?.initData),
    hash,
  })
}

/**
 * Links that ask the OS to reopen a URL in the real browser.
 * Android: Chrome intent (falls back to the plain URL if Chrome is missing).
 * iOS 17+: x-safari-https scheme opens Safari.
 */
export function externalBrowserLinks(url, platform) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return { android: null, ios: null }
  }
  if (parsed.protocol !== 'https:') return { android: null, ios: null }
  const rest = `${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`
  return {
    android: platform === 'android'
      ? `intent://${rest}#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(parsed.href)};end`
      : null,
    ios: platform === 'ios' ? `x-safari-https://${rest}` : null,
  }
}

/**
 * Firebase signInWithRedirect only works reliably when the auth handler is
 * served from the app's own origin (Safari ITP / Chrome storage partitioning
 * block the cross-site firebaseapp.com iframe). When the deployment proxies
 * /__/auth/* to Firebase, list its hosts in VITE_FIREBASE_AUTH_PROXY_HOSTS and
 * we use the page host as authDomain.
 */
export function resolveAuthDomain({ configured = '', proxyHosts = '', host = '', protocol = 'https:' } = {}) {
  const hosts = String(proxyHosts || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  const current = String(host || '').toLowerCase()
  if (current && protocol === 'https:' && hosts.includes(current)) return current
  return configured || ''
}

/** Redirect needs the auth handler on the same host as the page. */
export function canUseRedirect(authDomain, host) {
  return Boolean(authDomain && host && String(authDomain).toLowerCase() === String(host).toLowerCase())
}

/** Prefer redirect on iOS/iPadOS Safari and other browsers that block OAuth popups. */
export function shouldPreferGoogleRedirect(
  userAgent = '',
  platform = '',
  maxTouchPoints = 0
) {
  const ua = String(userAgent || '')
  const isIOS = isIOSDevice(ua, platform, maxTouchPoints)
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|Firefox|FxiOS|OPR|Opera/i.test(ua)
  const isAndroidWebView = /\bwv\b|; wv\)/i.test(ua)
  return Boolean(isIOS || isSafari || isAndroidWebView)
}

/** Popup errors where retrying with a full-page redirect makes sense. */
export function isPopupUnavailable(error) {
  return [
    'auth/popup-blocked',
    'auth/operation-not-supported-in-this-environment',
    'auth/web-storage-unsupported',
  ].includes(error?.code)
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
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return 'Google sign-in was cancelled.'
    case 'auth/popup-blocked':
      return 'Pop-up blocked. Allow pop-ups for this site and try again.'
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase.'
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Firebase Auth. Authorize this storefront domain in Firebase Authentication.'
    case 'auth/operation-not-supported-in-this-environment':
    case 'auth/web-storage-unsupported':
      return 'This browser blocks Google sign-in. Open VOLTENIQ in Safari or Chrome, or use email and password.'
    case 'auth/internal-error':
      return 'Google sign-in could not start. Please try again, or use email and password.'
    case 'auth/embedded-browser':
      return 'Google does not allow sign-in inside in-app browsers. Open VOLTENIQ in Safari or Chrome, or use email and password.'
    default:
      return error?.message || 'Authentication failed.'
  }
}

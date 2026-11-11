import test from 'node:test'
import assert from 'node:assert/strict'
import { mapFirebaseAuthError, shouldPreferGoogleRedirect } from './firebaseAuthPolicy.js'

test('shouldPreferGoogleRedirect targets iPhone Safari and iPad', () => {
  assert.equal(
    shouldPreferGoogleRedirect(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'iPhone',
      5
    ),
    true
  )
  assert.equal(
    shouldPreferGoogleRedirect(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'MacIntel',
      0
    ),
    true
  )
  assert.equal(
    shouldPreferGoogleRedirect(
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'iPad',
      5
    ),
    true
  )
})

test('shouldPreferGoogleRedirect keeps desktop Chrome on popup path', () => {
  assert.equal(
    shouldPreferGoogleRedirect(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Win32',
      0
    ),
    false
  )
})

test('mapFirebaseAuthError covers popup and unauthorized domain cases', () => {
  assert.match(mapFirebaseAuthError({ code: 'auth/popup-blocked' }), /Pop-up blocked/i)
  assert.match(mapFirebaseAuthError({ code: 'auth/unauthorized-domain' }), /not authorized/i)
  assert.match(mapFirebaseAuthError({ code: 'auth/network-request-failed' }), /Network error/i)
}
)

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
  iphoneWebView: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  androidWebView: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36',
  telegramAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-G991B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 Telegram-Android/10.5.0',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 311.0.2.30.110',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  desktopChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

test('detectEmbeddedBrowser flags Telegram, Instagram and generic WebViews', async () => {
  const { detectEmbeddedBrowser } = await import('./firebaseAuthPolicy.js')
  assert.deepEqual(detectEmbeddedBrowser({ userAgent: UA.telegramAndroid }), { embedded: true, app: 'telegram', platform: 'android' })
  // Telegram iOS Mini App / in-app WebView: no Telegram UA token, but the bridge exists.
  assert.equal(detectEmbeddedBrowser({ userAgent: UA.iphoneWebView, hasTelegramProxy: true }).app, 'telegram')
  assert.equal(detectEmbeddedBrowser({ userAgent: UA.iphoneSafari, hash: '#tgWebAppData=abc' }).app, 'telegram')
  assert.equal(detectEmbeddedBrowser({ userAgent: UA.instagram }).app, 'instagram')
  assert.deepEqual(detectEmbeddedBrowser({ userAgent: UA.androidWebView }), { embedded: true, app: 'webview', platform: 'android' })
  assert.deepEqual(detectEmbeddedBrowser({ userAgent: UA.iphoneWebView }), { embedded: true, app: 'webview', platform: 'ios' })
})

test('detectEmbeddedBrowser leaves real browsers alone', async () => {
  const { detectEmbeddedBrowser } = await import('./firebaseAuthPolicy.js')
  for (const ua of [UA.iphoneSafari, UA.iphoneChrome, UA.androidChrome, UA.macSafari, UA.desktopChrome]) {
    assert.equal(detectEmbeddedBrowser({ userAgent: ua }).embedded, false, ua)
  }
  assert.equal(detectEmbeddedBrowser({ userAgent: UA.macSafari, platform: 'MacIntel', maxTouchPoints: 5 }).platform, 'ios')
})

test('externalBrowserLinks builds Chrome intent and Safari scheme links', async () => {
  const { externalBrowserLinks } = await import('./firebaseAuthPolicy.js')
  const android = externalBrowserLinks('https://volteniq.vercel.app/login?x=1', 'android')
  assert.equal(android.ios, null)
  assert.match(android.android, /^intent:\/\/volteniq\.vercel\.app\/login\?x=1#Intent;scheme=https;/)
  assert.match(android.android, /S\.browser_fallback_url=https%3A%2F%2Fvolteniq\.vercel\.app%2Flogin%3Fx%3D1;end$/)
  assert.deepEqual(externalBrowserLinks('https://volteniq.vercel.app/login', 'ios'), {
    android: null,
    ios: 'x-safari-https://volteniq.vercel.app/login',
  })
  assert.deepEqual(externalBrowserLinks('http://localhost:5173/login', 'android'), { android: null, ios: null })
  assert.deepEqual(externalBrowserLinks('not a url', 'ios'), { android: null, ios: null })
})

test('resolveAuthDomain uses the page host only for listed HTTPS proxy hosts', async () => {
  const { resolveAuthDomain, canUseRedirect } = await import('./firebaseAuthPolicy.js')
  const configured = 'volteniq.firebaseapp.com'
  assert.equal(resolveAuthDomain({ configured, host: 'volteniq.vercel.app' }), configured)
  assert.equal(resolveAuthDomain({ configured, proxyHosts: 'volteniq.vercel.app, shop.example', host: 'volteniq.vercel.app' }), 'volteniq.vercel.app')
  assert.equal(resolveAuthDomain({ configured, proxyHosts: 'volteniq.vercel.app', host: 'preview-abc.vercel.app' }), configured)
  assert.equal(resolveAuthDomain({ configured, proxyHosts: 'localhost:5173', host: 'localhost:5173', protocol: 'http:' }), configured)
  assert.equal(canUseRedirect(configured, 'volteniq.vercel.app'), false)
  assert.equal(canUseRedirect('volteniq.vercel.app', 'volteniq.vercel.app'), true)
  assert.equal(canUseRedirect('', 'volteniq.vercel.app'), false)
})

test('popup-unavailable errors fall back to redirect; embedded errors explain the fix', async () => {
  const { isPopupUnavailable, mapFirebaseAuthError } = await import('./firebaseAuthPolicy.js')
  assert.equal(isPopupUnavailable({ code: 'auth/popup-blocked' }), true)
  assert.equal(isPopupUnavailable({ code: 'auth/operation-not-supported-in-this-environment' }), true)
  assert.equal(isPopupUnavailable({ code: 'auth/popup-closed-by-user' }), false)
  assert.match(mapFirebaseAuthError({ code: 'auth/embedded-browser' }), /Safari or Chrome/)
  assert.match(mapFirebaseAuthError({ code: 'auth/web-storage-unsupported' }), /Safari or Chrome/)
})

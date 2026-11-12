import { useMemo, useState } from 'react'
import { currentEmbeddedBrowser, externalBrowserLinks } from '../../lib/firebaseAuthPolicy'

function GoogleGlyph({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.1.1 6.3 5.3C39.2 36.8 44 32 44 24c0-1.3-.1-2.7-.4-3.9z"
      />
    </svg>
  )
}

const APP_NAMES = {
  telegram: 'Telegram',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  line: 'LINE',
  snapchat: 'Snapchat',
  linkedin: 'LinkedIn',
  wechat: 'WeChat',
  twitter: 'X',
}

function openInExternalBrowser(url, links, app) {
  // Telegram Mini Apps / WebViews expose an API that opens the system browser.
  try {
    if (app === 'telegram' && window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(url)
      return true
    }
    if (app === 'telegram' && window.TelegramWebviewProxy?.postEvent) {
      window.TelegramWebviewProxy.postEvent('web_app_open_link', JSON.stringify({ url }))
      return true
    }
  } catch { /* Older Telegram clients: fall through to OS links. */ }
  const target = links.android || links.ios
  if (target) {
    window.location.href = target
    return true
  }
  return false
}

function EmbeddedBrowserNotice({ browser }) {
  const [showLink, setShowLink] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = useMemo(() => {
    const next = new URL(window.location.href)
    next.hash = ''
    return next.href
  }, [])
  const links = useMemo(() => externalBrowserLinks(url, browser.platform), [url, browser.platform])
  const appName = APP_NAMES[browser.app] || 'this app'
  const browserName = browser.platform === 'ios' ? 'Safari' : browser.platform === 'android' ? 'Chrome' : 'your browser'

  const copy = async () => {
    setShowLink(true)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch { /* Clipboard blocked: the visible field lets the user copy manually. */ }
  }

  return (
    <div className="rounded-xl border border-silver/30 p-4 text-sm space-y-3" role="note" data-testid="embedded-browser-notice">
      <p>
        <strong>Google sign-in does not work inside {appName}.</strong>{' '}
        Open this page in {browserName} to continue with Google, or sign in with email and password above.
      </p>
      <button
        type="button"
        className="auth-google-btn w-full"
        onClick={() => {
          if (!openInExternalBrowser(url, links, browser.app)) setShowLink(true)
        }}
      >
        <GoogleGlyph />
        <span>Open in {browserName}</span>
      </button>
      <button type="button" className="w-full text-volt font-semibold" onClick={copy}>
        {copied ? 'Link copied' : 'Copy link'}
      </button>
      {showLink ? (
        <label className="block">
          <span className="block text-muted mb-1">Paste this link in {browserName}:</span>
          <input
            readOnly
            className="auth-input"
            value={url}
            onFocus={(event) => event.target.select()}
          />
        </label>
      ) : null}
      <p className="text-muted">
        {browser.app === 'telegram'
          ? 'In Telegram, tap ⋮ or ··· and choose “Open in browser”.'
          : 'Use the app menu (⋮ or ···) and choose “Open in browser”.'}
      </p>
    </div>
  )
}

export default function GoogleSignInButton({ onClick, disabled, label = 'Continue with Google' }) {
  const browser = useMemo(() => currentEmbeddedBrowser(), [])
  if (browser.embedded) return <EmbeddedBrowserNotice browser={browser} />
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="auth-google-btn w-full"
    >
      <GoogleGlyph />
      <span>{label}</span>
    </button>
  )
}

import { useState } from 'react'

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

export default function GoogleSignInButton({ onClick, disabled, label = 'Continue with Google' }) {
  const [showLink, setShowLink] = useState(false)
  const browserUrl = new URL('/login', location.origin).href
  const embedded = /Telegram|FBAN|FBAV|Instagram|; wv\)/i.test(navigator.userAgent) ||
    Boolean(window.TelegramWebviewProxy || window.Telegram?.WebApp?.initData || /tgWebAppPlatform/i.test(location.hash))
  if (embedded) return <div className="rounded-xl border border-silver/30 p-4 text-sm" role="note">
    <strong>Open in Safari or Chrome to continue with Google</strong>
    <button type="button" className="auth-google-btn w-full" onClick={() => {
      try {
        if (location.protocol === 'https:' && window.Telegram?.WebApp?.openLink) {
          window.Telegram.WebApp.openLink(browserUrl)
        } else if (location.protocol === 'https:' && window.TelegramWebviewProxy?.postEvent) {
          window.TelegramWebviewProxy.postEvent('web_app_open_link', JSON.stringify({ url: browserUrl }))
        }
      } catch { /* Older Telegram clients can use the link below. */ }
      setShowLink(true)
    }}>Open sign-in in browser</button>
    {showLink && <label>Paste this link in your browser
      <input readOnly value={browserUrl} onFocus={event => event.target.select()} />
    </label>}
    <p>Your session will open in the external browser. Use this browser's menu and choose Open in Browser, or sign in with email here.</p>
  </div>
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

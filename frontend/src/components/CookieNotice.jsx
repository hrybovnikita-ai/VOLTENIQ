import { useState } from 'react'

const acknowledgment = 'volteniq_cookie_notice=seen'

export default function CookieNotice() {
  const [visible, setVisible] = useState(() =>
    !document.cookie.split(';').some(entry => entry.trim() === acknowledgment)
  )

  function dismiss() {
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = acknowledgment + '; Path=/; Max-Age=15552000; SameSite=Lax' + secure
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside aria-label="Cookie notice" className="fixed bottom-4 left-4 right-4 z-50 max-w-sm rounded-2xl border border-white/20 bg-neutral-900 p-5 text-white shadow-xl">
      <h2 className="font-semibold">Cookies on Volteniq</h2>
      <p className="my-3 text-sm text-neutral-200">
        We use a cookie to keep you signed in. Dismissing this notice saves your choice for 180 days.
      </p>
      <button type="button" onClick={dismiss} className="rounded-lg bg-orange-500 px-4 py-2 font-semibold text-black">
        Got it
      </button>
    </aside>
  )
}

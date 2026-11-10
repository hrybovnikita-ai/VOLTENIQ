const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {}

export const CLERK_PUBLISHABLE_KEY = viteEnv.VITE_CLERK_PUBLISHABLE_KEY || ''

export const isClerkEnabled = Boolean(CLERK_PUBLISHABLE_KEY)

/** Same-origin Clerk Dashboard proxy URL for production Frontend API traffic. */
export const CLERK_PROXY_URL = (
  viteEnv.VITE_CLERK_PROXY_URL
  || 'https://volteniq.vercel.app/__clerk'
).replace(/\/$/, '')

export function shouldUseClerkProxy(hostname = typeof window !== 'undefined' ? window.location.hostname : '') {
  if (!hostname) return Boolean(viteEnv.PROD)
  return (
    hostname === 'volteniq.vercel.app'
    || hostname.endsWith('.volteniq.vercel.app')
    || hostname.endsWith('-hrybov-nikita-s-projects.vercel.app')
    || Boolean(viteEnv.PROD && viteEnv.VITE_CLERK_PROXY_URL)
  )
}

export function resolveClerkProxyUrl(
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
  origin = typeof window !== 'undefined' ? window.location.origin : ''
) {
  if (!shouldUseClerkProxy(hostname)) return undefined
  // Prefer same-origin so preview aliases never call the broken clerk.* DNS host.
  if (origin && /vercel\.app$/i.test(hostname)) {
    return `${origin}/__clerk`
  }
  return CLERK_PROXY_URL
}

export function mapClerkError(error) {
  const first = error?.errors?.[0]
  if (first?.longMessage) return first.longMessage
  if (first?.message) return first.message
  if (error?.message) return error.message
  return 'Authentication failed. Please try again.'
}

export function clerkErrorCodes(error) {
  return (error?.errors || []).map((entry) => entry.code).filter(Boolean)
}

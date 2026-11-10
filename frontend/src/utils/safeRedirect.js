/**
 * Only allow same-app relative paths after login/signup.
 * Rejects protocol-relative URLs (//evil), absolute URLs, and empty junk.
 */
export function safeRedirectPath(value, fallback = '/') {
  if (typeof value !== 'string') return fallback
  const path = value.trim()
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return fallback
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return fallback
  return path
}

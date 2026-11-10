export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || ''

export const isClerkEnabled = Boolean(CLERK_PUBLISHABLE_KEY)

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

import axios from 'axios'

export function resolveApiUrl(rawEnv, locationOrigin = '') {
  const raw = String(rawEnv ?? '').trim()
  // Guard against Git Bash mangling `/api` into a Windows path when setting Vercel env.
  if (!raw || /^[A-Za-z]:[\\/]/.test(raw) || raw.includes('Program Files')) return '/api'

  const normalized = raw.replace(/\/$/, '') || '/api'
  // Prefer same-origin `/api` so HttpOnly session cookies stay first-party on
  // every Vercel alias (desktop + mobile Safari/Chrome). Absolute API hosts that
  // differ from the page origin make Set-Cookie cross-site and break auth.
  if (locationOrigin && /^https?:\/\//i.test(normalized)) {
    try {
      const api = new URL(normalized)
      const page = new URL(locationOrigin)
      if (page.hostname.endsWith('.vercel.app') && api.origin !== page.origin) return '/api'
      if (api.origin === page.origin) return `${api.pathname.replace(/\/$/, '') || '/api'}`
    } catch {
      return '/api'
    }
  }
  return normalized
}

const viteApiUrl = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_API_URL
  : undefined
const pageOrigin = typeof window !== 'undefined' ? window.location.origin : ''
const API_URL = resolveApiUrl(viteApiUrl, pageOrigin)

export const http = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      const networkError = new Error(
        'Cannot reach the VOLTENIQ API. Please check your connection and try again.'
      )
      networkError.status = 0
      return Promise.reject(networkError)
    }

    const payload = error.response.data
    const apiError = new Error(payload?.errors?.[0]?.message || payload?.message || 'The server could not complete the request. Please try again.')
    apiError.status = error.response.status
    apiError.provider = payload?.provider
    apiError.errors = payload?.errors
    apiError.code = payload?.code
    apiError.data = payload?.data
    return Promise.reject(apiError)
  }
)

/** Normalize axios response to the existing { success, data, message } shape. */
async function request(method, path, { params, data } = {}) {
  const response = await http.request({ method, url: path, params, data })
  return response.data
}

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
  )
}

export const api = {
  searchPhoto: (photo) => request('post', '/assistant', { data: { photo } }),
  askProduct: (productId, selections, message) => request('post', '/assistant', { data: { productId, selections, message } }),
  askAssistant: (message) => request('post', '/assistant', { data: { message } }),
  health: () => request('get', '/health'),
  getProducts: (params = {}) => request('get', '/products', { params: cleanParams(params) }),
  getFeatured: () => request('get', '/products/featured'),
  getCategories: () => request('get', '/products/categories'),
  suggestProducts: (q, limit = 8) =>
    request('get', '/products/suggest', { params: { q: q || '', limit } }),
  getProduct: (id) => request('get', `/products/${id}`),
  compareProducts: (ids) =>
    request('get', '/products/compare', { params: { ids: ids.join(',') } }),
  login: (body) => request('post', '/auth/login', { data: body }),
  forgotPassword: (body) => request('post', '/auth/forgot-password', { data: body }),
  resetPassword: (body) => request('post', '/auth/reset-password', { data: body }),
  verifyEmail: (body) => request('post', '/auth/verify-email', { data: body }),
  resendVerification: (body) => request('post', '/auth/resend-verification', { data: body }),
  logout: () => request('post', '/auth/logout'),
  register: (body) => request('post', '/auth/register', { data: body }),
  firebaseSession: (body) => request('post', '/auth/firebase', { data: body }),
  clerkSession: (body) => request('post', '/auth/clerk', { data: body }),
  authProviders: () => request('get', '/auth/providers'),
  session: () => request('get', '/auth/session'),
  me: () => request('get', '/auth/me'),
  listSessions: () => request('get', '/auth/sessions'),
  revokeSession: (id) => request('delete', `/auth/sessions/${id}`),
  revokeOtherSessions: (body = {}) => request('post', '/auth/sessions/revoke-all', { data: body }),
  updateProfile: (body) => request('put', '/auth/me', { data: body }),
  getOrders: () => request('get', '/orders'),
  getOrder: (id) => request('get', `/orders/${id}`),
  createOrder: (body) => request('post', '/orders', { data: body }),
  getCart: () => request('get', '/cart'),
  saveCart: (body) => request('put', '/cart', { data: body }),
  clearCart: () => request('delete', '/cart'),
  getFavorites: () => request('get', '/favorites'),
  toggleFavorite: (productId) =>
    request('post', '/favorites/toggle', { data: { productId } }),
  getReviews: (productId, params = {}) =>
    request('get', `/products/${productId}/reviews`, { params: cleanParams(params) }),
  createReview: (productId, body) =>
    request('post', `/products/${productId}/reviews`, { data: body }),
  updateReview: (productId, reviewId, body) =>
    request('put', `/products/${productId}/reviews/${reviewId}`, { data: body }),
  deleteReview: (productId, reviewId) =>
    request('delete', `/products/${productId}/reviews/${reviewId}`),
  validatePromo: (body) => request('post', '/promos/validate', { data: body }),
  adminStats: () => request('get', '/admin/stats'),
  adminProducts: (params = {}) =>
    request('get', '/admin/products', { params: cleanParams(params) }),
  adminCreateProduct: (body) => request('post', '/admin/products', { data: body }),
  adminUpdateProduct: (id, body) =>
    request('put', `/admin/products/${id}`, { data: body }),
  adminDeleteProduct: (id) => request('delete', `/admin/products/${id}`),
  adminOrders: () => request('get', '/admin/orders'),
  adminUpdateOrderStatus: (id, status) =>
    request('patch', `/admin/orders/${id}/status`, { data: { status } }),
  adminUpdateOrderTracking: (id, body) =>
    request('patch', `/admin/orders/${id}/tracking`, { data: body }),
  adminUsers: () => request('get', '/admin/users'),
  adminReviews: (params = {}) =>
    request('get', '/admin/reviews', { params: cleanParams(params) }),
  adminModerateReview: (id, status) =>
    request('patch', `/admin/reviews/${id}`, { data: { status } }),
  adminDeleteReview: (id) => request('delete', `/admin/reviews/${id}`),
  adminPromos: () => request('get', '/admin/promos'),
  adminCreatePromo: (body) => request('post', '/admin/promos', { data: body }),
  adminUpdatePromo: (id, body) => request('put', `/admin/promos/${id}`, { data: body }),
  adminDeletePromo: (id) => request('delete', `/admin/promos/${id}`),
  getPriceAlerts: () => request('get', '/alerts'),
  getAlertNotifications: () => request('get', '/alerts/notifications'),
  getPriceHistory: (productId) => request('get', `/alerts/history/${productId}`),
  createPriceAlert: (body) => request('post', '/alerts', { data: body }),
  deletePriceAlert: (id) => request('delete', `/alerts/${id}`),
  demoPriceDrop: (productId, percent = 8) =>
    request('post', `/alerts/demo-drop/${productId}`, { data: { percent } }),
  listChats: () => request('get', '/chats'),
  createChat: (body = {}) => request('post', '/chats', { data: body }),
  getChat: (id) => request('get', `/chats/${id}`),
  updateChat: (id, body) => request('patch', `/chats/${id}`, { data: body }),
  deleteChat: (id) => request('delete', `/chats/${id}`),
  appendChatMessages: (id, messages) =>
    request('post', `/chats/${id}/messages`, { data: { messages } }),
}

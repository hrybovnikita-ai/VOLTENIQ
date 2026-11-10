import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

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
  resetPassword: (body) => request('post', '/auth/reset-password', { data: body }),
  logout: () => request('post', '/auth/logout'),
  register: (body) => request('post', '/auth/register', { data: body }),
  firebaseSession: (body) => request('post', '/auth/firebase', { data: body }),
  clerkSession: (body) => request('post', '/auth/clerk', { data: body }),
  authProviders: () => request('get', '/auth/providers'),
  session: () => request('get', '/auth/session'),
  me: () => request('get', '/auth/me'),
  updateProfile: (body) => request('put', '/auth/me', { data: body }),
  getOrders: () => request('get', '/orders'),
  getOrder: (id) => request('get', `/orders/${id}`),
  createOrder: (body) => request('post', '/orders', { data: body }),
  getFavorites: () => request('get', '/favorites'),
  toggleFavorite: (productId) =>
    request('post', '/favorites/toggle', { data: { productId } }),
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
  adminUsers: () => request('get', '/admin/users'),
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

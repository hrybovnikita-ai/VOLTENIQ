// Storage access can throw in embedded browsers and privacy modes.
export const browserStorage = {
  getItem(key) {
    try { return window.localStorage.getItem(key) } catch { return null }
  },
  setItem(key, value) {
    try { window.localStorage.setItem(key, value) } catch { /* Optional persistence. */ }
  },
  removeItem(key) {
    try { window.localStorage.removeItem(key) } catch { /* Storage unavailable. */ }
  },
}

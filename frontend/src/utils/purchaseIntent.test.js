import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clearAuthRedirect,
  consumeAuthRedirect,
  peekAuthRedirect,
  saveAuthRedirect,
} from './purchaseIntent.js'

function memoryStorage() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

test('auth redirect survives a full-page Google redirect via sessionStorage', () => {
  globalThis.window = { sessionStorage: memoryStorage() }
  try {
    saveAuthRedirect('/checkout?step=2')
    assert.equal(peekAuthRedirect(), '/checkout?step=2')
    assert.equal(peekAuthRedirect(), '/checkout?step=2', 'peek must not clear')
    clearAuthRedirect()
    assert.equal(peekAuthRedirect(), null)
    saveAuthRedirect('/profile')
    assert.equal(consumeAuthRedirect('/'), '/profile')
    assert.equal(peekAuthRedirect(), null)
  } finally {
    delete globalThis.window
  }
})

test('auth redirect helpers never throw when storage is blocked (in-app WebViews)', () => {
  globalThis.window = {
    get sessionStorage() {
      throw new Error('SecurityError: storage disabled')
    },
  }
  try {
    assert.doesNotThrow(() => saveAuthRedirect('/checkout'))
    assert.equal(peekAuthRedirect(), null)
    assert.doesNotThrow(() => clearAuthRedirect())
    assert.equal(consumeAuthRedirect('/fallback'), '/fallback')
  } finally {
    delete globalThis.window
  }
})

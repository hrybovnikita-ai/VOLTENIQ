import test from 'node:test'
import assert from 'node:assert/strict'

import { PENDING_LOGOUT_KEY, clearLogoutPending, markLogoutPending, restoreStoreSession } from '../lib/signOut.js'

function memoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

test('refresh restores the cookie session when no sign-out is pending', async () => {
  const local = memoryStorage()
  let logouts = 0
  const user = await restoreStoreSession({
    local,
    logout: async () => { logouts += 1 },
    restore: async () => ({ id: 'u1' }),
  })
  assert.deepEqual(user, { id: 'u1' })
  assert.equal(logouts, 0)
})

test('refresh after an interrupted sign-out finishes it instead of signing back in', async () => {
  const local = memoryStorage()
  markLogoutPending(local)
  const order = []
  const user = await restoreStoreSession({
    local,
    logout: async () => { order.push('logout') },
    restore: async () => { order.push('restore'); return null },
  })
  assert.equal(user, null)
  assert.deepEqual(order, ['logout', 'restore'])
  assert.equal(local.getItem(PENDING_LOGOUT_KEY), null)
})

test('still offline on refresh: stay signed out locally and keep retrying', async () => {
  const local = memoryStorage()
  markLogoutPending(local)
  let restored = false
  const user = await restoreStoreSession({
    local,
    logout: async () => { throw Object.assign(new Error('offline'), { status: 0 }) },
    restore: async () => { restored = true; return { id: 'u1' } },
  })
  assert.equal(user, null)
  assert.equal(restored, false, 'a still-live cookie must not sign the user back in')
  assert.ok(local.getItem(PENDING_LOGOUT_KEY))
})

test('a hung pending-logout request times out and the page still loads signed out', async () => {
  const local = memoryStorage()
  markLogoutPending(local)
  const user = await restoreStoreSession({
    local,
    timeoutMs: 20,
    logout: () => new Promise(() => {}),
    restore: async () => ({ id: 'u1' }),
  })
  assert.equal(user, null)
})

test('signing in again clears the marker so the next refresh keeps the new session', async () => {
  const local = memoryStorage()
  markLogoutPending(local)
  clearLogoutPending(local) // what saveSession() does after login / Google / verify
  const user = await restoreStoreSession({
    local,
    logout: async () => { throw new Error('should not be called') },
    restore: async () => ({ id: 'u1' }),
  })
  assert.deepEqual(user, { id: 'u1' })
})

test('restore errors still surface to the caller (bootstrap treats them as signed out)', async () => {
  await assert.rejects(
    restoreStoreSession({ local: memoryStorage(), logout: async () => {}, restore: async () => { throw new Error('500') } }),
    /500/
  )
})

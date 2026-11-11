import test from 'node:test'
import assert from 'node:assert/strict'

import { clearStoreSession } from './clearStoreSession.js'

test('clearStoreSession clears local user after successful server logout', async () => {
  const revision = { current: 0 }
  let user = { id: 'u1' }
  await clearStoreSession({
    revision,
    logout: async () => {},
    restore: async () => null,
    setUser: (next) => { user = next },
  })
  assert.equal(user, null)
  assert.equal(revision.current, 1)
})

test('clearStoreSession retains retryable state when both requests fail', async () => {
  const revision = { current: 3 }
  let user = { id: 'u1' }
  await assert.rejects(clearStoreSession({
    revision,
    logout: async () => {
      const err = new Error('offline')
      err.status = 0
      throw err
    },
    restore: async () => {
      throw new Error('offline')
    },
    setUser: (next) => { user = next },
  }), /offline/)
  assert.equal(user.id, 'u1')
  assert.equal(revision.current, 4)
})

test('clearStoreSession throws when server session still exists after logout', async () => {
  const revision = { current: 0 }
  let user = { id: 'u1' }
  await assert.rejects(
    () => clearStoreSession({
      revision,
      logout: async () => {},
      restore: async () => ({ id: 'u1' }),
      setUser: (next) => { user = next },
    }),
    (err) => err.code === 'logout_session_persist'
  )
  assert.equal(user.id, 'u1')
})

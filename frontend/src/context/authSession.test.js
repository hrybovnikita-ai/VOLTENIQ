import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Mirrors AuthContext clearStoreSession control flow for regression coverage
 * without mounting React.
 */
async function clearStoreSession({ logout, restore, setUser, revision }) {
  revision.current += 1
  let serverError = null
  try {
    await logout()
  } catch (error) {
    serverError = error
  }

  let stillSignedIn = false
  try {
    const remaining = await restore()
    stillSignedIn = Boolean(remaining)
  } catch {
    stillSignedIn = false
  }

  setUser(null)

  if (stillSignedIn) {
    const err = new Error(
      serverError?.message
        || 'Sign-out could not revoke the server session. Please try again.'
    )
    err.code = 'logout_session_persist'
    throw err
  }
}

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

test('clearStoreSession clears local user even when logout network fails', async () => {
  const revision = { current: 3 }
  let user = { id: 'u1' }
  await clearStoreSession({
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
  })
  assert.equal(user, null)
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
  assert.equal(user, null)
})

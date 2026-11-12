import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PENDING_LOGOUT_KEY,
  SIGNED_OUT_PATH,
  clearAuthStorage,
  isLogoutPending,
  performSignOut,
  withTimeout,
} from './signOut.js'

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed))
  return {
    get length() { return map.size },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
    keys: () => [...map.keys()].sort(),
  }
}

const never = () => new Promise(() => {})

function harness(overrides = {}) {
  const calls = { server: 0, redirects: [], cleared: 0 }
  const local = memoryStorage({
    volteniq_theme: 'dark',
    volteniq_favorites: '["p1"]',
    volteniq_compare: '[]',
    volteniq_cart: '[{"id":"p1"}]',
    volteniq_token: 'legacy',
    'firebase:authUser:key:volteniq-google': '{}',
    '__clerk_db_jwt': 'x',
    'volteniq:purchase:u1': 'o1',
  })
  const session = memoryStorage({
    volteniq_google_redirect: '1',
    volteniq_auth_redirect: '/checkout',
    'firebase:pendingRedirect:key:volteniq-google': '"true"',
    unrelated: 'keep',
  })
  const options = {
    serverLogout: async () => { calls.server += 1 },
    providers: [],
    clearState: () => { calls.cleared += 1 },
    redirect: (path) => calls.redirects.push(path),
    local,
    session,
    timeoutMs: 50,
    providerTimeoutMs: 30,
    ...overrides,
  }
  return { calls, local, session, options }
}

test('signs out: server, providers, state, storage, then hard redirect to /login', async () => {
  let providerCalls = 0
  const { calls, local, session, options } = harness({
    providers: [async () => { providerCalls += 1 }],
  })
  const result = await performSignOut(options)
  assert.deepEqual(result, { server: 'ok', providers: ['ok'], deadline: false })
  assert.equal(calls.server, 1)
  assert.equal(providerCalls, 1)
  assert.equal(calls.cleared, 1)
  assert.deepEqual(calls.redirects, [SIGNED_OUT_PATH])
  assert.equal(SIGNED_OUT_PATH, '/login?signedOut=1')
  // Auth leftovers gone, preferences kept.
  assert.deepEqual(local.keys(), ['volteniq_compare', 'volteniq_favorites', 'volteniq_theme'])
  assert.deepEqual(session.keys(), ['unrelated'])
  assert.equal(isLogoutPending(local), false)
})

test('a provider that never resolves (Firebase/Clerk in a WebView) cannot block the redirect', async () => {
  const { calls, options } = harness({ providers: [never, async () => {}] })
  const result = await performSignOut(options)
  assert.deepEqual(result.providers, ['timeout', 'ok'])
  assert.equal(result.server, 'ok')
  assert.deepEqual(calls.redirects, [SIGNED_OUT_PATH])
})

test('a provider that throws synchronously or rejects still redirects', async () => {
  const { calls, options } = harness({
    providers: [() => { throw new Error('boom') }, async () => { throw new Error('nope') }],
  })
  const result = await performSignOut(options)
  assert.deepEqual(result.providers, ['failed', 'failed'])
  assert.deepEqual(calls.redirects, [SIGNED_OUT_PATH])
})

test('offline: server logout fails, client still signs out and leaves a retry marker', async () => {
  let attempts = 0
  const { calls, local, options } = harness({
    serverLogout: async () => {
      attempts += 1
      const error = new Error('Cannot reach the VOLTENIQ API.')
      error.status = 0
      throw error
    },
  })
  const result = await performSignOut(options)
  assert.equal(result.server, 'failed')
  assert.equal(attempts, 2, 'network failures are retried once')
  assert.equal(calls.cleared, 1)
  assert.deepEqual(calls.redirects, [SIGNED_OUT_PATH])
  assert.ok(local.getItem(PENDING_LOGOUT_KEY), 'next page load retries the logout')
})

test('a hung logout request is cut off by the timeout and not retried', async () => {
  let attempts = 0
  const { calls, options } = harness({ serverLogout: () => { attempts += 1; return never() } })
  const started = Date.now()
  const result = await performSignOut(options)
  assert.equal(result.server, 'failed')
  assert.equal(attempts, 1)
  assert.ok(Date.now() - started < 1000)
  assert.deepEqual(calls.redirects, [SIGNED_OUT_PATH])
})

test('4xx responses are not retried', async () => {
  let attempts = 0
  const { options } = harness({
    serverLogout: async () => {
      attempts += 1
      throw Object.assign(new Error('Origin is not allowed'), { status: 403 })
    },
  })
  await performSignOut(options)
  assert.equal(attempts, 1)
})

test('double taps share one sign-out run', async () => {
  let release
  const { calls, options } = harness({
    timeoutMs: 1000,
    serverLogout: () => { calls.server += 1; return new Promise((resolve) => { release = resolve }) },
  })
  const first = performSignOut(options)
  const second = performSignOut(options)
  const third = performSignOut(options)
  assert.equal(first, second)
  assert.equal(second, third)
  await new Promise((resolve) => setTimeout(resolve, 0))
  release()
  await first
  assert.equal(calls.server, 1)
  assert.deepEqual(calls.redirects, [SIGNED_OUT_PATH])
})

test('the redirect runs even if clearing state throws', async () => {
  const { calls, options } = harness({ clearState: () => { throw new Error('render crash') } })
  await performSignOut(options)
  assert.deepEqual(calls.redirects, [SIGNED_OUT_PATH])
})

test('Clerk-style providers run after the server call so their navigation cannot abort it', async () => {
  const order = []
  const { options } = harness({
    serverLogout: async () => { order.push('server') },
    providers: [async () => { order.push('clerk') }],
  })
  await performSignOut(options)
  assert.deepEqual(order, ['server', 'clerk'])
})

test('clearAuthStorage tolerates storage that throws (private mode / WebView)', () => {
  const throwing = {
    get length() { throw new Error('SecurityError') },
    key() { throw new Error('SecurityError') },
    removeItem() { throw new Error('SecurityError') },
  }
  assert.doesNotThrow(() => clearAuthStorage({ local: throwing, session: null }))
})

test('withTimeout resolves, rejects, and times out', async () => {
  assert.equal(await withTimeout(async () => 7, 50), 7)
  await assert.rejects(withTimeout(async () => { throw new Error('x') }, 50), /x/)
  await assert.rejects(withTimeout(never, 10, 'thing'), (error) => error.code === 'timeout')
})

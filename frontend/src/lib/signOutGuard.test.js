import test from 'node:test'
import assert from 'node:assert/strict'

import { SIGNED_OUT_PATH, createSignOutGuard, isLogoutPending, onPageRestored, performSignOut } from './signOut.js'

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed))
  return {
    get length() { return map.size },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

// Manual timers so settle/watchdog behaviour is deterministic.
function fakeTimers() {
  let next = 1
  const pending = new Map()
  return {
    setTimer: (fn, ms) => { const id = next++; pending.set(id, { fn, ms }); return id },
    clearTimer: (id) => { pending.delete(id) },
    flush: () => { const due = [...pending.entries()]; pending.clear(); for (const [, t] of due) t.fn() },
    get size() { return pending.size },
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

function guardHarness(run) {
  const timers = fakeTimers()
  const states = []
  const guard = createSignOutGuard({ run, onBusyChange: (busy) => states.push(busy), setTimer: timers.setTimer, clearTimer: timers.clearTimer })
  return { guard, timers, states }
}

test('double and triple taps on Sign Out start exactly one logout', async () => {
  let runs = 0
  const { guard, states } = guardHarness(() => { runs += 1; return new Promise(() => {}) })
  assert.equal(guard.trigger(), true)
  assert.equal(guard.trigger(), false)
  assert.equal(guard.trigger(), false)
  assert.equal(runs, 1)
  assert.deepEqual(states, [true])
  assert.equal(guard.isBusy(), true)
})

test('if the page is still here after logout settles, the button re-enables and a second tap retries', async () => {
  let runs = 0
  const { guard, timers, states } = guardHarness(async () => { runs += 1 })
  guard.trigger()
  await tick()
  assert.equal(timers.size, 1, 'watchdog armed once the run settles')
  assert.equal(guard.trigger(), false, 'still busy while the redirect should be happening')
  timers.flush()
  assert.equal(guard.isBusy(), false)
  assert.deepEqual(states, [true, false])
  assert.equal(guard.trigger(), true)
  assert.equal(runs, 2)
})

test('a logout that rejects or throws synchronously cannot leave the button stuck', async () => {
  for (const run of [() => Promise.reject(new Error('boom')), () => { throw new Error('sync boom') }]) {
    const { guard, timers } = guardHarness(run)
    assert.equal(guard.trigger(), true)
    await tick()
    timers.flush()
    assert.equal(guard.isBusy(), false)
    assert.equal(guard.trigger(), true, 'retry after failure works')
  }
})

test('a hung logout still lets reset() (bfcache restore / new sign-in) re-enable the button', async () => {
  let runs = 0
  const { guard } = guardHarness(() => { runs += 1; return new Promise(() => {}) })
  guard.trigger()
  guard.reset()
  assert.equal(guard.isBusy(), false)
  assert.equal(guard.trigger(), true)
  assert.equal(runs, 2)
})

test('a stale watchdog from an earlier run never cancels a newer run', async () => {
  let release
  const { guard, timers } = guardHarness(() => new Promise((resolve) => { release = resolve }))
  guard.trigger()
  const firstRelease = release
  guard.reset() // e.g. pageshow persisted
  guard.trigger() // user taps again
  firstRelease() // the first, abandoned run settles late
  await tick()
  assert.equal(timers.size, 0, 'no watchdog armed for the abandoned run')
  assert.equal(guard.isBusy(), true)
})

test('trigger(task) runs the given task, so the latest logout function is used', async () => {
  const seen = []
  const { guard, timers } = guardHarness()
  guard.trigger(async () => seen.push('a'))
  await tick(); timers.flush()
  guard.trigger(async () => seen.push('b'))
  await tick()
  assert.deepEqual(seen, ['a', 'b'])
})

test('sign-out redirects by the deadline even if the logout request hangs (slow tablet / WebView)', async () => {
  const local = memoryStorage()
  const redirects = []
  const started = Date.now()
  const outcome = await performSignOut({
    serverLogout: () => new Promise(() => {}),
    providers: [() => new Promise(() => {})],
    redirect: (path) => redirects.push(path),
    local,
    session: memoryStorage(),
    timeoutMs: 400,
    providerTimeoutMs: 400,
    deadlineMs: 40,
  })
  assert.ok(Date.now() - started < 300, 'did not wait for the request timeout')
  assert.equal(outcome.deadline, true)
  assert.deepEqual(redirects, [SIGNED_OUT_PATH])
  assert.equal(isLogoutPending(local), true, 'next page load finishes the logout')
})

test('repeated sign-outs in one document each run and redirect (sign in again, sign out again)', async () => {
  let server = 0
  const redirects = []
  const options = {
    serverLogout: async () => { server += 1 },
    redirect: (path) => redirects.push(path),
    local: memoryStorage(),
    session: memoryStorage(),
    timeoutMs: 50,
  }
  await performSignOut(options)
  await performSignOut(options)
  await performSignOut(options)
  assert.equal(server, 3)
  assert.equal(redirects.length, 3)
})

test('retry after a failed sign-out: the second attempt reaches the server', async () => {
  let calls = 0
  const local = memoryStorage()
  const options = {
    serverLogout: async () => {
      calls += 1
      if (calls <= 2) { const e = new Error('offline'); e.status = 0; throw e }
    },
    redirect: () => {},
    local,
    session: memoryStorage(),
    timeoutMs: 50,
  }
  const first = await performSignOut(options)
  assert.equal(first.server, 'failed')
  assert.equal(isLogoutPending(local), true)
  const second = await performSignOut(options)
  assert.equal(second.server, 'ok')
  assert.equal(isLogoutPending(local), false)
})

test('onPageRestored fires only for bfcache restores (pageshow persisted)', () => {
  const win = new EventTarget()
  let restored = 0
  const detach = onPageRestored(() => { restored += 1 }, win)
  const show = (persisted) => {
    const event = new Event('pageshow')
    Object.defineProperty(event, 'persisted', { value: persisted })
    win.dispatchEvent(event)
  }
  show(false)
  assert.equal(restored, 0)
  show(true)
  assert.equal(restored, 1)
  detach()
  show(true)
  assert.equal(restored, 1)
})

test('onPageRestored is a no-op without a window (SSR / tests)', () => {
  const detach = onPageRestored(() => {}, undefined)
  assert.equal(typeof detach, 'function')
  detach()
})

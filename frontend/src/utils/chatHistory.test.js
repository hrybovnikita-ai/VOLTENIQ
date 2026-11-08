import test from 'node:test'
import assert from 'node:assert/strict'
import { splitPinnedRecent, titleFromContent } from './chatHistory.js'

test('titleFromContent trims and truncates', () => {
  assert.equal(titleFromContent('  Best MacBook  '), 'Best MacBook')
  assert.ok(titleFromContent('x'.repeat(80)).endsWith('…'))
})

test('splitPinnedRecent sorts pinned first then by activity', () => {
  const { pinned, recent } = splitPinnedRecent([
    { id: '1', title: 'Old', pinned: false, updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: '2', title: 'Pinned', pinned: true, updatedAt: '2026-01-02T00:00:00.000Z' },
    { id: '3', title: 'New', pinned: false, updatedAt: '2026-02-01T00:00:00.000Z' },
  ])
  assert.deepEqual(
    pinned.map((c) => c.id),
    ['2']
  )
  assert.deepEqual(
    recent.map((c) => c.id),
    ['3', '1']
  )
})

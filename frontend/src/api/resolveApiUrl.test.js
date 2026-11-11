import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveApiUrl } from './client.js'

test('resolveApiUrl rejects Git Bash mangled Windows paths', () => {
  assert.equal(resolveApiUrl('C:/Program Files/Git/api'), '/api')
  assert.equal(resolveApiUrl(''), '/api')
  assert.equal(resolveApiUrl(undefined), '/api')
})

test('resolveApiUrl collapses same-origin absolute API hosts to /api', () => {
  assert.equal(
    resolveApiUrl('https://volteniq.vercel.app/api', 'https://volteniq.vercel.app'),
    '/api'
  )
  assert.equal(
    resolveApiUrl('https://volteniq.vercel.app/api/', 'https://volteniq.vercel.app'),
    '/api'
  )
})

test('resolveApiUrl keeps cross-origin absolute API hosts', () => {
  assert.equal(
    resolveApiUrl('https://api.example.com/api', 'https://volteniq.vercel.app'),
    'https://api.example.com/api'
  )
})

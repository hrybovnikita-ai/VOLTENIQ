import test from 'node:test'
import assert from 'node:assert/strict'
import { safeRedirectPath } from './safeRedirect.js'

test('safeRedirectPath allows relative app paths only', () => {
  assert.equal(safeRedirectPath('/profile'), '/profile')
  assert.equal(safeRedirectPath('/checkout?step=1'), '/checkout?step=1')
  assert.equal(safeRedirectPath('//evil.example'), '/')
  assert.equal(safeRedirectPath('https://evil.example'), '/')
  assert.equal(safeRedirectPath('http://evil.example'), '/')
  assert.equal(safeRedirectPath('\\windows'), '/')
  assert.equal(safeRedirectPath(''), '/')
  assert.equal(safeRedirectPath(null, '/home'), '/home')
})

test('rejects URLs that become protocol-relative after browser normalization', () => {
  assert.equal(safeRedirectPath('/\t/example.com'), '/')
})

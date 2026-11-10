import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveClerkProxyUrl, shouldUseClerkProxy } from './clerk.js'

test('production vercel hosts use the same-origin Clerk proxy', () => {
  assert.equal(shouldUseClerkProxy('volteniq.vercel.app'), true)
  assert.equal(
    resolveClerkProxyUrl('volteniq.vercel.app', 'https://volteniq.vercel.app'),
    'https://volteniq.vercel.app/__clerk'
  )
  assert.equal(
    resolveClerkProxyUrl(
      'volteniq-git-main-hrybov-nikita-s-projects.vercel.app',
      'https://volteniq-git-main-hrybov-nikita-s-projects.vercel.app'
    ),
    'https://volteniq-git-main-hrybov-nikita-s-projects.vercel.app/__clerk'
  )
})

test('local hosts do not force the production Clerk proxy', () => {
  assert.equal(shouldUseClerkProxy('localhost'), false)
  assert.equal(resolveClerkProxyUrl('localhost', 'http://localhost:5173'), undefined)
})

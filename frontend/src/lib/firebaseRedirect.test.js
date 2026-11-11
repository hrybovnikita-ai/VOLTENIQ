import test from 'node:test'
import assert from 'node:assert/strict'
import { mapFirebaseAuthError, shouldPreferGoogleRedirect } from './firebaseAuthPolicy.js'

test('shouldPreferGoogleRedirect targets iPhone Safari and iPad', () => {
  assert.equal(
    shouldPreferGoogleRedirect(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'iPhone',
      5
    ),
    true
  )
  assert.equal(
    shouldPreferGoogleRedirect(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'MacIntel',
      0
    ),
    true
  )
  assert.equal(
    shouldPreferGoogleRedirect(
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'iPad',
      5
    ),
    true
  )
})

test('shouldPreferGoogleRedirect keeps desktop Chrome on popup path', () => {
  assert.equal(
    shouldPreferGoogleRedirect(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Win32',
      0
    ),
    false
  )
})

test('mapFirebaseAuthError covers popup and unauthorized domain cases', () => {
  assert.match(mapFirebaseAuthError({ code: 'auth/popup-blocked' }), /Pop-up blocked/i)
  assert.match(mapFirebaseAuthError({ code: 'auth/unauthorized-domain' }), /not authorized/i)
  assert.match(mapFirebaseAuthError({ code: 'auth/network-request-failed' }), /Network error/i)
}
)

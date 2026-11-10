import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { parseActionCodeURL, sendSignInLinkToEmail } from 'firebase/auth'
import { auth, mapFirebaseAuthError } from '../lib/firebase'
import { api } from '../api/client'
import AuthLayout from '../components/auth/AuthLayout'
import AuthPasswordField from '../components/auth/AuthPasswordField'
import Button from '../components/ui/Button'

export default function RecoveryPage() {
  const { pathname } = useLocation()
  const reset = pathname === '/reset-password'
  const action = reset ? parseActionCodeURL(window.location.href) : null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (reset && password !== confirm) return setError('Passwords do not match.')
    if (reset && new TextEncoder().encode(password).length > 72) return setError('Use a password of at most 72 bytes.')
    setBusy(true)
    try {
      if (reset) {
        await api.resetPassword({ email: email.trim(), password, code: action.code })
        setPassword('')
        setConfirm('')
        window.history.replaceState(null, '', '/reset-password')
      } else {
        await sendSignInLinkToEmail(auth, email.trim(), {
          url: window.location.origin + '/reset-password',
          handleCodeInApp: true,
        })
      }
      setDone(true)
    } catch (err) {
      setError(reset ? err.message : mapFirebaseAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  const invalid = reset && action?.operation !== 'EMAIL_SIGNIN'
  return <AuthLayout title={reset ? 'Reset password' : 'Forgot password?'}
    subtitle={reset ? 'Set a new password for your VOLTENIQ account.' : 'Enter your account email to receive a one-time recovery link.'}
    footer={<Link className="text-volt font-semibold" to="/login">Back to Sign In</Link>}>
    {done ? <p role="status">{reset ? 'Your password has been updated. Sign in with your new password.' : 'Check your inbox and spam folder for your recovery link.'}</p>
      : invalid ? <p role="alert">This link is incomplete. <Link to="/forgot-password" className="text-volt">Request a new link</Link></p>
      : <form className="space-y-4" onSubmit={submit}>
        <label className="block">Email<input type="email" required autoComplete="email" className="auth-input mt-1" value={email} onChange={e => setEmail(e.target.value)} /></label>
        {reset && <>
          <AuthPasswordField id="new-password" label="New password" autoComplete="new-password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
          <AuthPasswordField id="confirm-password" label="Confirm password" autoComplete="new-password" minLength={6} value={confirm} onChange={e => setConfirm(e.target.value)} />
        </>}
        {error && <p role="alert" className="text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Please wait…' : reset ? 'Update password' : 'Send recovery link'}</Button>
      </form>}
  </AuthLayout>
}

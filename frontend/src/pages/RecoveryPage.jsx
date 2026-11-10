import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import AuthLayout from '../components/auth/AuthLayout'
import AuthPasswordField from '../components/auth/AuthPasswordField'
import Button from '../components/ui/Button'

export default function RecoveryPage() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const reset = pathname === '/reset-password'
  const [email, setEmail] = useState(params.get('email') || '')
  const [token] = useState(params.get('token') || '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (reset && password !== confirm) return setError('Passwords do not match.')
    if (reset && password.length < 8) return setError('Password must be at least 8 characters.')
    if (reset && new TextEncoder().encode(password).length > 72) return setError('Use a password of at most 72 bytes.')
    if (reset && !token) return setError('This reset link is incomplete. Request a new one.')
    setBusy(true)
    try {
      if (reset) {
        await api.resetPassword({ email: email.trim(), password, token })
        setPassword('')
        setConfirm('')
      } else {
        await api.forgotPassword({ email: email.trim() })
      }
      setDone(true)
    } catch (err) {
      setError(err.message || 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={reset ? 'Reset password' : 'Forgot password?'}
      subtitle={reset
        ? 'Set a new password for your VOLTENIQ account.'
        : 'Enter your account email to receive a one-time recovery link.'}
      footer={<Link className="text-volt font-semibold" to="/login">Back to Sign In</Link>}
    >
      {done ? (
        <p role="status">
          {reset
            ? 'Your password has been updated. Sign in with your new password.'
            : 'If an account exists for that email, a reset link has been sent.'}
        </p>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <label className="block">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              className="auth-input mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {reset ? (
            <>
              <AuthPasswordField
                id="new-password"
                label="New password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <AuthPasswordField
                id="confirm-password"
                label="Confirm password"
                autoComplete="new-password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </>
          ) : null}
          {error ? <p role="alert" className="text-red-500">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Please wait…' : reset ? 'Update password' : 'Send recovery link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}

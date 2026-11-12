import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/auth/AuthLayout'
import Button from '../components/ui/Button'

export default function VerifyEmailPage() {
  const { verifyEmailCode, resendVerification, isAuthenticated } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const emailParam = params.get('email') || ''
  const tokenParam = params.get('token') || ''
  const [email, setEmail] = useState(emailParam)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [info, setInfo] = useState(
    tokenParam ? '' : 'Enter the email you registered with to resend a verification link.'
  )

  async function onVerify() {
    setStatus('verifying')
    setError('')
    try {
      await verifyEmailCode({ email: emailParam, token: tokenParam })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Verification failed')
      setStatus('error')
    }
  }

  if (isAuthenticated && !tokenParam) return <Navigate to="/" replace />

  async function onResend(event) {
    event.preventDefault()
    setError('')
    setInfo('')
    setStatus('sending')
    try {
      await resendVerification(email.trim())
      setStatus('idle')
      setInfo('If that account needs verification, a new email has been sent.')
    } catch (err) {
      setStatus('idle')
      setError(err.message || 'Could not resend verification email')
    }
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Confirm ownership of your email before signing in with a password."
      footer={<Link className="text-volt font-semibold" to="/login">Back to Sign In</Link>}
    >
      {tokenParam && emailParam && status !== 'error' ? (
        <div className="space-y-4">
          <p className="break-words">{emailParam}</p>
          <Button onClick={onVerify} disabled={status === 'verifying'}>
            {status === 'verifying' ? 'Verifying…' : 'Verify my email'}
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onResend}>
          <label className="block text-sm" htmlFor="verify-email">
            Email
            <input
              id="verify-email"
              type="email"
              required
              className="auth-input mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          {info ? <p role="status" className="text-sm text-muted">{info}</p> : null}
          {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Resend verification email'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}

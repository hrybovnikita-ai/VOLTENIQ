import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/auth/AuthLayout'
import AuthPasswordField from '../components/auth/AuthPasswordField'
import GoogleSignInButton from '../components/auth/GoogleSignInButton'
import Button from '../components/ui/Button'
import { safeRedirectPath } from '../utils/safeRedirect'
import { clearAuthRedirect, peekAuthRedirect } from '../utils/purchaseIntent'

const inputClass = 'auth-input'

export default function LoginPage() {
  const { login, loginWithGoogle, isAuthenticated, googleEnabled, authError, clearAuthError } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(location.state?.oauthError || '')
  const [loading, setLoading] = useState(false)

  // Router state is lost across a full-page Google redirect; RequireAuth and
  // checkout also save the destination in sessionStorage.
  const [savedRedirect] = useState(() => peekAuthRedirect())
  const shownError = error || authError

  useEffect(() => {
    if (isAuthenticated) clearAuthRedirect()
  }, [isAuthenticated])

  if (isAuthenticated) {
    const dest = safeRedirectPath(location.state?.from || savedRedirect, '/')
    return <Navigate to={dest} replace />
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    clearAuthError()
    try {
      await login(form.email.trim(), form.password)
    } catch (err) {
      if (err.code === 'email_unverified') {
        navigate(`/verify-email?email=${encodeURIComponent(err.data?.email || form.email.trim())}`, {
          replace: true,
        })
        return
      }
      setError(err.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Sign In"
      subtitle="Welcome back to VOLTENIQ."
      footer={
        <p className="text-sm text-silver/70">
          New to VOLTENIQ?{' '}
          <Link
            to="/signup"
            state={location.state}
            className="text-volt font-semibold hover:underline"
          >
            Create Account
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-snow/90 mb-1.5">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>

        <AuthPasswordField
          id="login-password"
          label="Password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          autoComplete="current-password"
          placeholder="Your password"
        />

        <Link className="block text-sm text-volt font-semibold" to="/forgot-password">Forgot password?</Link>

        {shownError ? <p role="alert" className="text-sm text-red-400">{shownError}</p> : null}

        <Button type="submit" className="w-full rounded-[16px]" size="lg" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="h-px flex-1 bg-silver/20" />
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted">or</span>
        <div className="h-px flex-1 bg-silver/20" />
      </div>

      {googleEnabled ? (
        <GoogleSignInButton
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            setError('')
            clearAuthError()
            try {
              const user = await loginWithGoogle()
              // null => browser redirected to Google (Safari / popup blocked).
              if (!user) return
            } catch (err) {
              setError(err.message || 'Google sign-in failed')
              setLoading(false)
            }
          }}
        />
      ) : (
        <p className="text-sm text-muted text-center">Google sign-in is currently unavailable. Use email and password.</p>
      )}
    </AuthLayout>
  )
}

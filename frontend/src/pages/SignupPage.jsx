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

export default function SignupPage() {
  const { register, loginWithGoogle, isAuthenticated, googleEnabled, authError, clearAuthError } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
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
    setError('')
    clearAuthError()
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const result = await register({
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      })
      if (result?.needsVerification) {
        navigate(`/verify-email?email=${encodeURIComponent(result.email || form.email.trim())}`, { replace: true })
        return
      }
    } catch (err) {
      setError(err.message || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Sign up to continue to checkout."
      footer={
        <p className="text-sm text-silver/70">
          Already have an account?{' '}
          <Link
            to="/login"
            state={location.state}
            className="text-volt font-semibold hover:underline"
          >
            Sign In
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="signup-email" className="block text-sm font-medium text-snow/90 mb-1.5">
            Email
          </label>
          <input
            id="signup-email"
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
          id="signup-password"
          label="Password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          minLength={8}
        />

        <AuthPasswordField
          id="signup-confirm"
          label="Confirm Password"
          value={form.confirmPassword}
          onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
          autoComplete="new-password"
          placeholder="Repeat your password"
          minLength={8}
        />

        {shownError ? (
          <p role="alert" className="text-sm text-red-400">
            {shownError}
            {/already registered|already exists/i.test(shownError) ? (
              <>
                {' '}
                <Link to="/login" state={location.state} className="text-volt font-semibold hover:underline">
                  Sign In
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        <Button type="submit" className="w-full rounded-[16px]" size="lg" disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
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

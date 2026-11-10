import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/auth/AuthLayout'
import AuthPasswordField from '../components/auth/AuthPasswordField'
import GoogleSignInButton from '../components/auth/GoogleSignInButton'
import Button from '../components/ui/Button'

const inputClass = 'auth-input'

export default function SignupPage() {
  const { register, loginWithGoogle, isAuthenticated, clerkEnabled } = useAuth()
  const location = useLocation()
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    const dest = location.state?.from || '/'
    return <Navigate to={dest} replace />
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      })
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
          placeholder="At least 6 characters"
          minLength={6}
        />

        <AuthPasswordField
          id="signup-confirm"
          label="Confirm Password"
          value={form.confirmPassword}
          onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
          autoComplete="new-password"
          placeholder="Repeat your password"
          minLength={6}
        />

        {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}

        <Button type="submit" className="w-full rounded-[16px]" size="lg" disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="h-px flex-1 bg-silver/20" />
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted">or</span>
        <div className="h-px flex-1 bg-silver/20" />
      </div>

      {clerkEnabled ? (
        <GoogleSignInButton
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            setError('')
            try {
              await loginWithGoogle()
            } catch (err) {
              setError(err.message || 'Google sign-in failed')
              setLoading(false)
            }
          }}
        />
      ) : (
        <p className="text-sm text-muted text-center">Google sign-in requires Clerk configuration.</p>
      )}
    </AuthLayout>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useClerk, useAuth as useClerkAuth } from '@clerk/react'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/auth/AuthLayout'
import { mapClerkError } from '../lib/clerk'

/**
 * Completes Clerk's Google OAuth redirect, syncs the verified identity into the
 * VOLTENIQ cookie session, then sends the shopper home. No password or profile form.
 */
export default function SsoCallbackPage() {
  const clerk = useClerk()
  const { isLoaded, isSignedIn } = useClerkAuth()
  const { syncClerkSession } = useAuth()
  const [error, setError] = useState('')
  const operation = useRef(null)
  const navigate = useNavigate()
  const finish = new URLSearchParams(window.location.search).has('finish')

  useEffect(() => {
    const timer = setTimeout(
      () => setError('Google sign-in could not finish. Open VOLTENIQ in Safari or Chrome and try again.'),
      20000
    )
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!isLoaded) return undefined
    let active = true

    if (!operation.current) {
      const destination = `${window.location.origin}/sso-callback?finish=1`
      operation.current = finish
        ? (isSignedIn
          ? syncClerkSession()
          : Promise.reject(new Error('No active Google session. Please try again.')))
        : clerk.handleRedirectCallback({
          signInUrl: '/login',
          signUpUrl: '/login',
          signInForceRedirectUrl: destination,
          signUpForceRedirectUrl: destination,
          continueSignUpUrl: destination,
        })
    }

    operation.current
      .then(() => {
        if (active && finish) navigate('/', { replace: true })
      })
      .catch((err) => {
        if (active) setError(mapClerkError(err))
      })

    return () => {
      active = false
    }
  }, [clerk, isLoaded, isSignedIn, finish, syncClerkSession, navigate])

  return (
    <AuthLayout title={error ? 'Sign-in needs attention' : 'Finishing Google sign-in'}>
      <p role={error ? 'alert' : 'status'}>
        {error || 'Signing you in to VOLTENIQ…'}
      </p>
      {error ? (
        <Link to="/login" replace className="mt-4 inline-block text-volt">
          Return to sign in
        </Link>
      ) : null}
    </AuthLayout>
  )
}

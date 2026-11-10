import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useClerk, useAuth as useClerkAuth } from '@clerk/react'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/auth/AuthLayout'
import { mapClerkError } from '../lib/clerk'

export default function SsoCallbackPage() {
  const clerk = useClerk()
  const { isLoaded, isSignedIn } = useClerkAuth()
  const { syncClerkSession } = useAuth()
  const [error, setError] = useState('')
  const operation = useRef(null)
  const navigate = useNavigate()
  const finish = new URLSearchParams(location.search).has('finish')
  useEffect(() => {
    const timer = setTimeout(() => setError('Google sign-in could not finish. Open VOLTENIQ in Safari or Chrome and try again.'), 20000)
    return () => clearTimeout(timer)
  }, [])
  useEffect(() => {
    if (!isLoaded) return
    let active = true
    if (!operation.current) {
      const destination = location.origin + '/sso-callback?finish=1'
      operation.current = finish
        ? (isSignedIn ? syncClerkSession() : Promise.reject(new Error('No active Google session. Please try again.')))
        : clerk.handleRedirectCallback({
          signInUrl: '/login', signUpUrl: '/signup',
          signInForceRedirectUrl: destination, signUpForceRedirectUrl: destination,
        })
    }
    operation.current.then(() => {
      if (active && finish) navigate('/', { replace: true })
    }).catch(err => { if (active) setError(mapClerkError(err)) })
    return () => { active = false }
  }, [clerk, isLoaded, isSignedIn, finish, syncClerkSession, navigate])
  return <AuthLayout title={error ? 'Sign-in needs attention' : 'Finishing Google sign-in'}>
    <p role={error ? 'alert' : 'status'}>{error || 'Connecting your VOLTENIQ account…'}</p>
    <Link to="/login" replace className="mt-4 inline-block text-volt">Return to sign in</Link>
  </AuthLayout>
}

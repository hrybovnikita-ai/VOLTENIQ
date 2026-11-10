import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthenticateWithRedirectCallback, useAuth as useClerkAuth } from '@clerk/react'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/auth/AuthLayout'
import Spinner from '../components/ui/Spinner'

export default function SsoCallbackPage() {
  const navigate = useNavigate()
  const { isSignedIn, isLoaded } = useClerkAuth()
  const { syncClerkSession, isAuthenticated } = useAuth()

  useEffect(() => {
    let active = true
    async function finish() {
      if (!isLoaded || !isSignedIn) return
      try {
        if (!isAuthenticated) await syncClerkSession()
        if (active) navigate('/', { replace: true })
      } catch {
        if (active) navigate('/login', { replace: true, state: { oauthError: 'Google sign-in failed' } })
      }
    }
    finish()
    return () => {
      active = false
    }
  }, [isLoaded, isSignedIn, isAuthenticated, syncClerkSession, navigate])

  return (
    <AuthLayout title="Finishing sign-in" subtitle="Connecting your VOLTENIQ session…">
      <div className="flex flex-col items-center gap-3 py-6" role="status">
        <Spinner />
        <p className="text-sm text-muted">Please wait a moment.</p>
      </div>
      <AuthenticateWithRedirectCallback />
    </AuthLayout>
  )
}

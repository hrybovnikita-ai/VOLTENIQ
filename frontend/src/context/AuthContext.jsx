import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth as useClerkAuth, useClerk } from '@clerk/react'
import { api } from '../api/client'
import { isClerkEnabled, mapClerkError } from '../lib/clerk'
import Spinner from '../components/ui/Spinner'

const AuthContext = createContext(null)


async function restoreCookieSession() {
  const { data } = await api.session()
  return data.user || null
}

function ClerkAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const revision = useRef(0)
  const clerk = useClerkAuth()
  const clerkSdk = useClerk()

  const saveSession = useCallback(({ data }) => {
    revision.current += 1
    setUser(data.user)
    return data.user
  }, [])

  const syncClerkSession = useCallback(async () => {
    if (!clerk.isSignedIn) return null
    const token = await clerk.getToken()
    if (!token) throw new Error('Google session expired. Please sign in again.')
    return saveSession(await api.clerkSession({ token }))
  }, [clerk.isSignedIn, clerk.getToken, saveSession])

  useEffect(() => {
    const version = revision.current
    let active = true
    localStorage.removeItem('volteniq_token')

    async function bootstrap() {


      // Restore the store cookie independently of the external OAuth SDK.


      try {
        const nextUser = await restoreCookieSession()
        if (active && version === revision.current) setUser(nextUser)
      } catch {
        if (active && version === revision.current) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    bootstrap()
    return () => {
      active = false
    }
  }, [])

  async function login(email, password) {
    return saveSession(await api.login({ email, password }))
  }

  async function register({ email, password }) {
    const nextUser = saveSession(await api.register({ email, password }))
    return { user: nextUser, needsVerification: false }
  }

  async function verifyEmailCode() {
    throw new Error('Email verification is handled by the store account flow')
  }

  async function loginWithGoogle(mode = 'signIn') {
    if (clerk.isSignedIn) return syncClerkSession()
    // A first click can arrive before the external Clerk script has initialized.
    const deadline = Date.now() + 8000
    while (!clerkSdk.client && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (!clerkSdk.client) {
      throw new Error('Google sign-in could not load. Retry in Safari or Chrome, or use email and password.')
    }
    try {
      await clerkSdk.client[mode].authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/sso-callback?finish=1`,
      })
    } catch (error) {
      throw new Error(mapClerkError(error), { cause: error })
    }
    return null
  }

  async function logout() {
    revision.current += 1
    try {
      await api.logout()
    } finally {
      try {
        if (clerk.isSignedIn) await clerkSdk.signOut({ redirectUrl: window.location.origin })
      } catch {
        // Cookie session already cleared.
      }
      setUser(null)
    }
  }

  async function updateProfileInfo(payload) {
    const { data } = await api.updateProfile(payload)
    setUser(data.user)
    return data.user
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        isAdmin: user?.role === 'ADMIN',
        clerkEnabled: true,
        login,
        register,
        verifyEmailCode,
        loginWithGoogle,
        logout,
        updateProfile: updateProfileInfo,
        syncClerkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

function LegacyAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const revision = useRef(0)

  useEffect(() => {
    const version = revision.current
    let active = true
    localStorage.removeItem('volteniq_token')

    restoreCookieSession()
      .then((nextUser) => {
        if (active && version === revision.current) setUser(nextUser)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  function saveSession({ data }) {
    revision.current += 1
    setUser(data.user)
    return data.user
  }

  if (loading) {
    return (
      <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-3 bg-snow text-ink dark:bg-ink dark:text-snow">
        <Spinner />
        <p className="text-sm text-muted">Checking your session…</p>
      </div>
    )
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: false,
        isAuthenticated: Boolean(user),
        isAdmin: user?.role === 'ADMIN',
        clerkEnabled: false,
        login: async (email, password) => saveSession(await api.login({ email, password })),
        register: async ({ email, password }) => ({
          user: saveSession(await api.register({ email, password })),
          needsVerification: false,
        }),
        verifyEmailCode: async () => {
          throw new Error('Email verification is unavailable')
        },
        loginWithGoogle: async () => {
          throw new Error('Google sign-in requires Clerk. Set VITE_CLERK_PUBLISHABLE_KEY and redeploy.')
        },
        logout: async () => {
          revision.current += 1
          try {
            await api.logout()
          } finally {
            setUser(null)
          }
        },
        updateProfile: async (payload) => {
          const { data } = await api.updateProfile(payload)
          setUser(data.user)
          return data.user
        },
        syncClerkSession: async () => null,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function AuthProvider({ children }) {
  if (isClerkEnabled) return <ClerkAuthProvider>{children}</ClerkAuthProvider>
  return <LegacyAuthProvider>{children}</LegacyAuthProvider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

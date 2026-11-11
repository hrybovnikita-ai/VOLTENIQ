import { clearStoreSession } from './clearStoreSession'
import { browserStorage } from '../utils/browserStorage'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth as useClerkAuth, useClerk } from '@clerk/react'
import { api } from '../api/client'
import { isClerkEnabled, mapClerkError } from '../lib/clerk'
import { consumeGoogleRedirectResult, firebaseConfigured, firebaseSignOut, googleIdToken } from '../lib/firebase'
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
  }, [clerk, saveSession])

  useEffect(() => {
    const version = revision.current
    let active = true
    browserStorage.removeItem('volteniq_token')

    async function bootstrap() {
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
    const response = await api.register({ email, password })
    if (response?.data?.needsVerification) {
      return { user: null, needsVerification: true, email: response.data.email || email }
    }
    if (response?.data?.user) {
      return { user: saveSession(response), needsVerification: false }
    }
    return { user: null, needsVerification: true, email }
  }

  const verifyEmailCode = useCallback(async ({ email, token }) => (
    saveSession(await api.verifyEmail({ email, token }))
  ), [saveSession])

  const resendVerification = useCallback(async (email) => (
    api.resendVerification({ email })
  ), [])

  async function loginWithGoogle() {
    if (clerk.isSignedIn) return syncClerkSession()
    const deadline = Date.now() + 8000
    while (!clerkSdk.client && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    if (!clerkSdk.client?.signIn) {
      throw new Error('Google sign-in could not load. Retry in Safari or Chrome, or use email and password.')
    }
    try {
      await clerkSdk.client.signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/sso-callback?finish=1`,
        oidcPrompt: 'select_account',
      })
    } catch (error) {
      throw new Error(mapClerkError(error), { cause: error })
    }
    return null
  }

  async function logout() {
    await clearStoreSession({ revision, setUser, logout: api.logout, restore: restoreCookieSession })
    if (clerk.isSignedIn) await clerkSdk.signOut({ redirectUrl: window.location.origin })
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
        googleEnabled: true,
        authError: '',
        clearAuthError: () => {},
        login,
        register,
        verifyEmailCode,
        resendVerification,
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
  const [authError, setAuthError] = useState('')
  const revision = useRef(0)

  const saveSession = useCallback(({ data }) => {
    revision.current += 1
    setAuthError('')
    setUser(data.user)
    return data.user
  }, [])

  useEffect(() => {
    const version = revision.current
    let active = true
    browserStorage.removeItem('volteniq_token')

    async function bootstrap() {
      // Complete a Firebase Google redirect before restoring a cookie session.
      // A failed redirect must still fall through to the cookie session and
      // tell the shopper why Google did not sign them in.
      let redirectToken = null
      if (firebaseConfigured) {
        try {
          redirectToken = await consumeGoogleRedirectResult()
        } catch (error) {
          if (active) setAuthError(error.message || 'Google sign-in failed. Please try again.')
        }
      }
      try {
        if (!active || version !== revision.current) return
        if (redirectToken) {
          try {
            saveSession(await api.firebaseSession({ idToken: redirectToken }))
            return
          } catch (error) {
            if (active) setAuthError(error.message || 'Google sign-in failed. Please try again.')
          }
        }

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
  }, [saveSession])

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
        googleEnabled: firebaseConfigured,
        authError,
        clearAuthError: () => setAuthError(''),
        login: async (email, password) => saveSession(await api.login({ email, password })),
        register: async ({ email, password }) => {
          const response = await api.register({ email, password })
          if (response?.data?.needsVerification) {
            return { user: null, needsVerification: true, email: response.data.email || email }
          }
          if (response?.data?.user) {
            return { user: saveSession(response), needsVerification: false }
          }
          return { user: null, needsVerification: true, email }
        },
        verifyEmailCode: async ({ email, token }) => saveSession(await api.verifyEmail({ email, token })),
        resendVerification: async (email) => api.resendVerification({ email }),
        loginWithGoogle: async () => {
          const idToken = await googleIdToken()
          // null => full-page redirect started (Safari / popup-blocked).
          if (!idToken) return null
          return saveSession(await api.firebaseSession({ idToken }))
        },
        logout: async () => {
          await clearStoreSession({ revision, setUser, logout: api.logout, restore: restoreCookieSession })
          await firebaseSignOut()
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
  if (isClerkEnabled && !firebaseConfigured) return <ClerkAuthProvider>{children}</ClerkAuthProvider>
  return <LegacyAuthProvider>{children}</LegacyAuthProvider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

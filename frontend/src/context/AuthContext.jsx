import { clearLogoutPending, onPageRestored, performSignOut, restoreStoreSession, SIGNED_OUT_PATH } from '../lib/signOut'
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

// Finishes an interrupted sign-out before trusting the cookie session.
function bootstrapCookieSession() {
  return restoreStoreSession({ logout: api.logout, restore: restoreCookieSession })
}

// iOS Safari, Telegram's WKWebView and Chrome restore pages from the
// back/forward cache with their old React state. Re-check the cookie session
// so a page from before a sign-out cannot show (or act as) a signed-in user.
function useRevalidateOnPageRestore(revision, setUser) {
  useEffect(() => onPageRestored(async () => {
    const version = ++revision.current
    let nextUser
    try {
      nextUser = await bootstrapCookieSession()
    } catch {
      nextUser = null
    }
    if (version === revision.current) setUser(nextUser)
  }), [revision, setUser])
}

function ClerkAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const revision = useRef(0)
  const clerk = useClerkAuth()
  const clerkSdk = useClerk()
  useRevalidateOnPageRestore(revision, setUser)

  const saveSession = useCallback(({ data }) => {
    revision.current += 1
    clearLogoutPending()
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
        const nextUser = await bootstrapCookieSession()
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

  function logout() {
    return performSignOut({
      serverLogout: api.logout,
      providers: clerk.isSignedIn ? [() => clerkSdk.signOut({ redirectUrl: SIGNED_OUT_PATH })] : [],
      clearState: () => {
        revision.current += 1
        setUser(null)
      },
    })
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
  useRevalidateOnPageRestore(revision, setUser)

  const saveSession = useCallback(({ data }) => {
    revision.current += 1
    clearLogoutPending()
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

        const nextUser = await bootstrapCookieSession()
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
        // Never rejects; always ends on /login (see lib/signOut.js).
        logout: () => performSignOut({
          serverLogout: api.logout,
          providers: firebaseConfigured ? [firebaseSignOut] : [],
          clearState: () => {
            revision.current += 1
            setUser(null)
          },
        }),
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

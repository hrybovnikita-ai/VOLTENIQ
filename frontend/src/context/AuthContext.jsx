import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth as useClerkAuth, useClerk } from '@clerk/react'
import { api } from '../api/client'
import { clerkErrorCodes, isClerkEnabled, mapClerkError } from '../lib/clerk'
import Spinner from '../components/ui/Spinner'

const AuthContext = createContext(null)

async function googleSessionFirebase() {
  const { auth, googleProvider, mapFirebaseAuthError } = await import('../lib/firebase')
  const { signInWithPopup, signOut } = await import('firebase/auth')
  try {
    const { user } = await signInWithPopup(auth, googleProvider)
    return await api.firebaseSession({ idToken: await user.getIdToken() })
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error), { cause: error })
  } finally {
    await signOut(auth)
  }
}

function SessionBootstrap({ children }) {
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
    if (!token) return null
    return saveSession(await api.clerkSession({ token }))
  }, [clerk, saveSession])

  useEffect(() => {
    const version = revision.current
    let active = true
    localStorage.removeItem('volteniq_token')

    async function bootstrap() {
      try {
        if (!clerk.isLoaded) return
        if (clerk.isSignedIn) {
          const synced = await syncClerkSession()
          if (active && version === revision.current && synced) return
        }
        const { data } = await api.session()
        if (active && version === revision.current) setUser(data.user)
      } catch {
        if (active && version === revision.current) setUser(null)
      } finally {
        if (active && clerk.isLoaded) setLoading(false)
      }
    }

    bootstrap()
    return () => {
      active = false
    }
  }, [clerk.isLoaded, clerk.isSignedIn, syncClerkSession])

  async function login(email, password) {
    try {
      const signIn = await clerkSdk.client.signIn.create({
        identifier: email,
        password,
      })
      if (signIn.status === 'complete') {
        await clerkSdk.setActive({ session: signIn.createdSessionId })
        return syncClerkSession()
      }
      throw new Error('Additional verification is required to finish signing in.')
    } catch (error) {
      const codes = clerkErrorCodes(error)
      const canFallback =
        codes.includes('form_identifier_not_found') ||
        codes.includes('form_password_incorrect') ||
        codes.includes('strategy_for_user_invalid')
      if (!canFallback && !error.status) {
        throw new Error(mapClerkError(error), { cause: error })
      }
    }

    return saveSession(await api.login({ email, password }))
  }

  async function register({ email, password }) {
    try {
      const signUp = await clerkSdk.client.signUp.create({
        emailAddress: email,
        password,
      })

      if (signUp.status === 'complete') {
        await clerkSdk.setActive({ session: signUp.createdSessionId })
        return { user: await syncClerkSession(), needsVerification: false }
      }

      if (signUp.unverifiedFields?.includes('email_address')) {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
        return { user: null, needsVerification: true }
      }

      throw new Error('Additional verification is required to finish creating your account.')
    } catch (error) {
      const codes = clerkErrorCodes(error)
      if (codes.includes('form_identifier_exists')) {
        return { user: await login(email, password), needsVerification: false }
      }
      throw new Error(mapClerkError(error), { cause: error })
    }
  }

  async function verifyEmailCode(code) {
    const result = await clerkSdk.client.signUp.attemptEmailAddressVerification({ code })
    if (result.status !== 'complete') {
      throw new Error('Invalid verification code')
    }
    await clerkSdk.setActive({ session: result.createdSessionId })
    return syncClerkSession()
  }

  async function loginWithGoogle() {
    await clerkSdk.client.signIn.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl: `${window.location.origin}/sso-callback`,
      redirectUrlComplete: `${window.location.origin}/`,
    })
    return null
  }

  async function logout() {
    revision.current += 1
    try {
      await api.logout()
    } finally {
      try {
        await clerkSdk.signOut({ redirectUrl: window.location.origin })
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

  if (loading || !clerk.isLoaded) {
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
    api
      .session()
      .then(({ data }) => {
        if (active && version === revision.current) setUser(data.user)
      })
      .catch(() => {
        if (active && version === revision.current) setUser(null)
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
        loading,
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
        loginWithGoogle: async () => saveSession(await googleSessionFirebase()),
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
  if (isClerkEnabled) return <SessionBootstrap>{children}</SessionBootstrap>
  return <LegacyAuthProvider>{children}</LegacyAuthProvider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

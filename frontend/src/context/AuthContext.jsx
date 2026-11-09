import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import Spinner from '../components/ui/Spinner'

const AuthContext = createContext(null)

async function googleSession() {
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const revision = useRef(0)

  useEffect(() => {
    const version = revision.current
    let active = true

    // Legacy JWT storage is never used for auth; clear any leftover value.
    localStorage.removeItem('volteniq_token')

    api
      .me()
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

  async function login(email, password) {
    return saveSession(await api.login({ email, password }))
  }

  async function register({ email, password }) {
    return saveSession(await api.register({ email, password }))
  }

  async function loginWithGoogle() {
    return saveSession(await googleSession())
  }

  async function logout() {
    revision.current += 1
    try {
      await api.logout()
    } finally {
      setUser(null)
    }
  }

  async function updateProfileInfo(payload) {
    const { data } = await api.updateProfile(payload)
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
        login,
        register,
        loginWithGoogle,
        logout,
        updateProfile: updateProfileInfo,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

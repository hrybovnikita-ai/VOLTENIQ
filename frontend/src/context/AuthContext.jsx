import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

const AuthContext = createContext(null)
const TOKEN_KEY = 'volteniq_token'

async function firebaseSession(method, credentials) {
  const { auth, googleProvider, mapFirebaseAuthError } = await import('../lib/firebase')
  const { signInWithPopup, signInWithEmailAndPassword } = await import('firebase/auth')
  let timer
  try {
    const exchange = async () => {
      const credential = method === 'google'
        ? await signInWithPopup(auth, googleProvider)
        : await signInWithEmailAndPassword(auth, credentials.email, credentials.password)
      return api.firebaseSession({ idToken: await credential.user.getIdToken() })
    }
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Sign-in timed out. Please try again.')),
        method === 'google' ? 120000 : 20000)
    })
    return await Promise.race([exchange(), timeout])
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error), { cause: error })
  } finally {
    clearTimeout(timer)
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const revision = useRef(0)

  useEffect(() => {
    const version = revision.current
    let active = true
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    api.me().then(({ data }) => {
      if (active && version === revision.current) setUser(data.user)
    }).catch((error) => {
      if (active && version === revision.current && error.status === 401) {
        localStorage.removeItem(TOKEN_KEY)
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  function saveSession({ data }) {
    revision.current++
    localStorage.setItem(TOKEN_KEY, data.token)
    setUser(data.user)
    return data.user
  }

  async function login(email, password) {
    const credentials = { email, password }
    try {
      return saveSession(await api.login(credentials))
    } catch (error) {
      if (error.provider !== 'firebase') throw error
      return saveSession(await firebaseSession('password', credentials))
    }
  }

  const register = async ({ email, password }) => saveSession(await api.register({ email, password }))
  const loginWithGoogle = async () => saveSession(await firebaseSession('google'))

  async function logout() {
    revision.current++
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
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

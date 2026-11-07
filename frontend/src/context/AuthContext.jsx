import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { api } from '../api/client'
import { auth, googleProvider, mapFirebaseAuthError } from '../lib/firebase'

const AuthContext = createContext(null)
const TOKEN_KEY = 'volteniq_token'

function nameFromEmail(email) {
  const local = String(email || '').split('@')[0] || 'Member'
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
    .slice(0, 60)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const syncingRef = useRef(false)

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const syncBackendSession = useCallback(
    async (fbUser) => {
      if (!fbUser) {
        clearSession()
        return null
      }

      const idToken = await fbUser.getIdToken()
      const res = await api.firebaseSession({ idToken })
      localStorage.setItem(TOKEN_KEY, res.data.token)
      setUser(res.data.user)
      return res.data.user
    },
    [clearSession]
  )

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)
      if (syncingRef.current) {
        setLoading(false)
        return
      }

      try {
        if (!fbUser) {
          clearSession()
          return
        }
        await syncBackendSession(fbUser)
      } catch {
        clearSession()
      } finally {
        setLoading(false)
      }
    })

    return unsubscribe
  }, [clearSession, syncBackendSession])

  const withAuthFlow = async (action) => {
    syncingRef.current = true
    try {
      const credential = await action()
      try {
        const appUser = await syncBackendSession(credential.user)
        setFirebaseUser(credential.user)
        return appUser
      } catch (syncError) {
        await signOut(auth).catch(() => {})
        clearSession()
        const mapped = new Error(
          syncError?.message || 'Signed in with Firebase, but the server session could not be created.'
        )
        mapped.code = syncError?.status || 'backend-sync'
        throw mapped
      }
    } catch (error) {
      if (error?.code === 'backend-sync' || error?.code === 401 || typeof error?.status === 'number') {
        throw error
      }
      const mapped = new Error(mapFirebaseAuthError(error))
      mapped.code = error?.code
      throw mapped
    } finally {
      syncingRef.current = false
      setLoading(false)
    }
  }

  const login = async (email, password) =>
    withAuthFlow(() => signInWithEmailAndPassword(auth, email, password))

  const register = async ({ email, password, name }) =>
    withAuthFlow(async () => {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      const displayName = (name || '').trim() || nameFromEmail(email)
      try {
        await updateProfile(credential.user, { displayName })
      } catch {
        // Profile display name is optional; continue if it fails.
      }
      return credential
    })

  const loginWithGoogle = async () =>
    withAuthFlow(() => signInWithPopup(auth, googleProvider))

  const logout = async () => {
    syncingRef.current = true
    try {
      await signOut(auth)
      clearSession()
      setFirebaseUser(null)
    } finally {
      syncingRef.current = false
    }
  }

  const updateProfileInfo = async (payload) => {
    const res = await api.updateProfile(payload)
    setUser(res.data.user)
    if (auth.currentUser && payload.name) {
      try {
        await updateProfile(auth.currentUser, { displayName: payload.name })
      } catch {
        // Keep backend profile as source of truth for the app shell.
      }
    }
    return res.data.user
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
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

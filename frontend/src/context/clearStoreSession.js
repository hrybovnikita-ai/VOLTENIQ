export async function clearStoreSession({ revision, setUser, logout, restore }) {
  revision.current += 1
  let serverError = null
  try {
    await logout()
  } catch (error) {
    serverError = error
  }

  let stillSignedIn
  try {
    const remaining = await restore()
    stillSignedIn = Boolean(remaining)
  } catch {
    if (serverError) throw serverError
    stillSignedIn = false
  }

  if (stillSignedIn) {
    const err = new Error(
      serverError?.message
        || 'Sign-out could not revoke the server session. Please try again.'
    )
    err.status = serverError?.status || 500
    err.code = 'logout_session_persist'
    throw err
  }
  setUser(null)
}

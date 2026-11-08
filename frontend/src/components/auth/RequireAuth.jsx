import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { saveAuthRedirect } from '../../utils/purchaseIntent'
import Spinner from '../ui/Spinner'

export default function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  if (!isAuthenticated) {
    const redirectTo = `${location.pathname}${location.search || ''}`
    saveAuthRedirect(redirectTo)
    return <Navigate to="/login" replace state={{ from: redirectTo }} />
  }

  return children
}

import { AuthenticateWithRedirectCallback } from '@clerk/react'
import AuthLayout from '../components/auth/AuthLayout'
import Spinner from '../components/ui/Spinner'

export default function SsoCallbackPage() {
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

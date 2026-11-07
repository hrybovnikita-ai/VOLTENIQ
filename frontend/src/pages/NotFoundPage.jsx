import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/ui/EmptyState'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="container-shell page-section">
      <EmptyState
        title="Page not found"
        description="That route does not exist in the VOLTENIQ demo."
        actionLabel="Go home"
        onAction={() => navigate('/')}
      />
    </div>
  )
}

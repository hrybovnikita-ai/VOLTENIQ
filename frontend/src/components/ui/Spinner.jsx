export default function Spinner({ className = 'w-8 h-8' }) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-silver/30 border-t-volt ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}

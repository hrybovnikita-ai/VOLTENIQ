import Button from './Button'

export default function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="glass rounded-[20px] px-8 py-12 text-center border-red-400/30">
      <h3 className="font-display text-xl font-bold mb-2">Unable to load</h3>
      <p className="text-muted mb-6">{message}</p>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

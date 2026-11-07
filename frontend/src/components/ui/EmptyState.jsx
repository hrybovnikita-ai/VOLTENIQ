import Button from './Button'

export default function EmptyState({ title, description, actionLabel, onAction, icon }) {
  return (
    <div className="glass rounded-[16px] sm:rounded-[20px] px-5 sm:px-8 py-10 sm:py-16 text-center">
      {icon && <div className="mx-auto mb-4 text-volt flex justify-center">{icon}</div>}
      <h3 className="font-display text-2xl font-bold mb-2">{title}</h3>
      {description && (
        <p className="text-muted max-w-md mx-auto mb-6">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  )
}

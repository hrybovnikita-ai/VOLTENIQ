import { cn } from '../../utils/format'

const variants = {
  primary:
    'bg-volt text-ink hover:brightness-110 shadow-[0_8px_24px_rgba(255,121,0,0.28)]',
  secondary:
    'bg-ink text-snow dark:bg-snow dark:text-ink hover:opacity-90',
  ghost:
    'bg-transparent border border-silver/40 text-ink dark:text-snow hover:border-volt hover:text-volt',
  soft:
    'bg-white/70 dark:bg-graphite/80 border border-silver/30 text-ink dark:text-snow hover:border-volt/50',
}

export default function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  as: Comp = 'button',
  ...props
}) {
  const sizes = {
    sm: 'min-h-10 px-3.5 py-2 text-sm rounded-[12px]',
    md: 'min-h-11 px-5 py-2.5 text-sm rounded-[14px]',
    lg: 'min-h-12 px-5 sm:px-6 py-3 text-[0.95rem] sm:text-base rounded-[16px]',
  }

  return (
    <Comp
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none touch-manipulation',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  )
}

import { cn } from '../../utils/format'

const variants = {
  primary:
    'bg-volt text-ink hover:brightness-110 shadow-[0_8px_28px_rgba(255,121,0,0.34)] hover:shadow-[0_10px_34px_rgba(255,121,0,0.42)]',
  secondary:
    'bg-ink/90 text-snow dark:bg-snow/95 dark:text-ink hover:opacity-90 backdrop-blur-md',
  ghost:
    'border border-silver/35 bg-white/25 dark:bg-white/5 text-ink dark:text-snow backdrop-blur-md hover:border-volt hover:text-volt hover:bg-volt/10 hover:shadow-[0_0_24px_rgba(255,121,0,0.16)]',
  soft:
    'border border-silver/30 bg-white/55 dark:bg-white/8 text-ink dark:text-snow backdrop-blur-md hover:border-volt/50 hover:shadow-[0_0_20px_rgba(255,121,0,0.12)]',
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

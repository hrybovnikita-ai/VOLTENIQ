import { Link } from 'react-router-dom'

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page min-h-dvh w-full flex items-center justify-center px-3 xs:px-4 py-6 sm:py-10">
      <div className="auth-page__glow" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-[420px] min-w-0">
        <div className="text-center mb-5 sm:mb-7">
          <Link
            to="/"
            className="inline-block font-display text-[1.65rem] sm:text-[1.7rem] font-extrabold tracking-tight text-snow hover:text-volt transition-colors"
          >
            VOLTENIQ
          </Link>
        </div>

        <div className="auth-card p-4 xs:p-5 sm:p-8">
          <h1 className="font-display text-[1.55rem] sm:text-[1.75rem] font-bold text-snow tracking-tight">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-silver/80 mt-2 mb-6 leading-relaxed">{subtitle}</p>
          ) : (
            <div className="mb-6" />
          )}
          {children}
        </div>

        {footer ? <div className="mt-5 text-center">{footer}</div> : null}
      </div>
    </div>
  )
}

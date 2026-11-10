import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  Menu,
  X,
  ShoppingBag,
  Heart,
  Moon,
  Sun,
  GitCompareArrows,
  Sparkles,
  Shield,
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useCart } from '../../context/CartContext'
import { useFavorites } from '../../context/FavoritesContext'
import { useCompare } from '../../context/CompareContext'
import { useAuth } from '../../context/AuthContext'
import SearchAutocomplete from '../search/SearchAutocomplete'

const links = [
  { to: '/catalog', label: 'Catalog' },
  { to: '/compare', label: 'Compare' },
  { to: '/assistant', label: 'AI Assistant' },
]

function displayName(user) {
  if (!user) return ''
  if (user.name?.trim()) return user.name.trim()
  return String(user.email || '').split('@')[0]
}

function initials(user) {
  const name = displayName(user)
  return (name || 'U').slice(0, 1).toUpperCase()
}

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { count } = useCart()
  const { ids: favIds } = useFavorites()
  const { ids: compareIds } = useCompare()
  const { user, isAdmin, logout, loading: authLoading } = useAuth()

  useEffect(() => {
    const escape = (event) => {
      if (event.key === 'Escape' && open) {
        setOpen(false)
        document.querySelector('[aria-controls="mobile-nav"]')?.focus()
      }
    }
    document.addEventListener('keydown', escape)
    document.body.classList.toggle('nav-open', open)
    return () => {
      document.body.classList.remove('nav-open')
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1280) setOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const linkClass = ({ isActive }) =>
    `block text-[0.95rem] font-medium transition-colors min-h-11 flex items-center ${
      isActive ? 'text-volt' : 'text-ink/75 dark:text-snow/75 hover:text-volt'
    }`

  const iconBtn =
    'items-center justify-center rounded-[12px] p-2.5 min-h-11 min-w-11 border border-transparent hover:border-silver/20 hover:bg-white/30 dark:hover:bg-white/5 transition'

  const close = () => setOpen(false)
  const closeDetails = (event) => {
    const details = event.currentTarget.closest('details')
    if (details) details.open = false
  }

  return (
    <header className="sticky top-0 z-50">
      <div className="glass-nav backdrop-blur-xl">
        <div className="container-shell">
          <div className="flex h-14 sm:h-16 items-center gap-2 sm:gap-3 min-w-0">
            <Link to="/" aria-label="VOLTENIQ home" className="flex items-center gap-2 shrink-0 min-w-0" onClick={close}>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-ink text-volt font-display font-extrabold glow-orange">
                V
              </span>
              <span className="font-display text-lg sm:text-xl font-extrabold tracking-tight truncate max-[360px]:hidden">
                VOLTENIQ
              </span>
            </Link>

            <nav className="hidden xl:flex items-center gap-5 ml-2 shrink-0">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors ${
                      isActive ? 'text-volt' : 'text-ink/70 dark:text-snow/70 hover:text-volt'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>

            <div className="hidden md:flex flex-1 min-w-0 max-w-2xl xl:max-w-3xl ml-auto">
              <SearchAutocomplete />
            </div>

            <div className="flex items-center gap-0.5 sm:gap-1 ml-auto md:ml-2 shrink-0">
              <button type="button" onClick={toggleTheme} className={`inline-flex ${iconBtn}`} aria-label="Toggle theme">
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <Link to="/assistant" className={`hidden sm:inline-flex ${iconBtn}`} aria-label="AI Assistant">
                <Sparkles className="w-5 h-5 text-volt" />
              </Link>

              <Link to="/compare" className={`relative hidden sm:inline-flex ${iconBtn}`} aria-label="Compare">
                <GitCompareArrows className="w-5 h-5" />
                {compareIds.length > 0 && (
                  <span className="absolute top-1 right-1 h-4 min-w-4 rounded-full bg-volt text-[10px] font-bold text-ink flex items-center justify-center px-1">
                    {compareIds.length}
                  </span>
                )}
              </Link>

              <Link to="/favorites" className={`relative hidden sm:inline-flex ${iconBtn}`} aria-label="Favorites">
                <Heart className="w-5 h-5" />
                {favIds.length > 0 && (
                  <span className="absolute top-1 right-1 h-4 min-w-4 rounded-full bg-volt text-[10px] font-bold text-ink flex items-center justify-center px-1">
                    {favIds.length}
                  </span>
                )}
              </Link>

              <Link to="/cart" className={`relative inline-flex ${iconBtn}`} aria-label="Cart">
                <ShoppingBag className="w-5 h-5" />
                {count > 0 && (
                  <span className="absolute top-1 right-1 h-4 min-w-4 rounded-full bg-volt text-[10px] font-bold text-ink flex items-center justify-center px-1">
                    {count}
                  </span>
                )}
              </Link>

              {isAdmin && (
                <Link to="/admin" className={`hidden sm:inline-flex ${iconBtn}`} aria-label="Admin">
                  <Shield className="w-5 h-5" />
                </Link>
              )}

              {authLoading ? (
                <div
                  className="hidden sm:block h-10 w-24 animate-pulse rounded-[12px] bg-silver/15"
                  aria-hidden="true"
                />
              ) : user ? (
                <details
                  className="relative"
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.open = false
                  }}
                >
                  <summary
                    aria-label="Account menu"
                    className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-silver/15 bg-graphite/90 py-1 pl-1 pr-2.5 text-volt [&::-webkit-details-marker]:hidden"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-sm font-bold text-volt">
                      {initials(user)}
                    </span>
                    <span className="hidden max-w-[7.5rem] truncate text-xs font-semibold text-snow/90 lg:inline">
                      {displayName(user)}
                    </span>
                  </summary>
                  <div className="glass-menu absolute right-0 top-12 z-50 w-56 p-2">
                    <div className="border-b border-silver/15 px-2 pb-2 mb-1">
                      <p className="truncate text-sm font-semibold text-snow">{displayName(user)}</p>
                      <p className="truncate text-xs text-muted">{user.email}</p>
                    </div>
                    <Link to="/profile" className="block rounded-lg p-2 hover:bg-volt/10 hover:text-volt" onClick={closeDetails}>
                      My Profile
                    </Link>
                    <Link to="/profile#orders" className="block rounded-lg p-2 hover:bg-volt/10 hover:text-volt" onClick={closeDetails}>
                      My Orders
                    </Link>
                    <Link to="/profile#settings" className="block rounded-lg p-2 hover:bg-volt/10 hover:text-volt" onClick={closeDetails}>
                      Settings
                    </Link>
                    <button
                      type="button"
                      className="w-full rounded-lg p-2 text-left hover:bg-volt/10 hover:text-volt"
                      onClick={() => {
                        logout()
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                </details>
              ) : (
                <div className="hidden sm:flex items-center gap-1">
                  <Link
                    to="/login"
                    className="inline-flex items-center text-sm font-semibold text-ink/80 dark:text-snow/80 px-2.5 min-h-11 hover:text-volt"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="inline-flex items-center text-sm font-semibold text-volt px-2.5 min-h-11"
                  >
                    Sign Up
                  </Link>
                </div>
              )}

              <button
                type="button"
                className={`inline-flex xl:hidden ${iconBtn}`}
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
                aria-controls="mobile-nav"
              >
                {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {open ? (
          <>
            <button
              type="button"
              className="xl:hidden fixed inset-0 top-14 sm:top-16 z-40 bg-ink/45 backdrop-blur-[2px]"
              aria-label="Close menu overlay"
              onClick={close}
            />
            <div
              id="mobile-nav"
              className="glass-nav xl:hidden relative z-50 border-t border-silver/20 animate-slide-down"
            >
              <div className="container-shell py-4 space-y-4 max-h-[min(78dvh,36rem)] overflow-y-auto overscroll-contain">
                <div className="md:hidden">
                  <SearchAutocomplete onNavigate={close} />
                </div>
                <nav className="flex flex-col gap-1">
                  {links.map((l) => (
                    <NavLink key={l.to} to={l.to} className={linkClass} onClick={close}>
                      {l.label}
                    </NavLink>
                  ))}
                  <NavLink to="/favorites" className={linkClass} onClick={close}>
                    Favorites
                  </NavLink>
                  <NavLink to="/cart" className={linkClass} onClick={close}>
                    Bag
                  </NavLink>
                  {authLoading ? (
                    <div className="h-11 rounded-lg bg-silver/15 animate-pulse" aria-hidden="true" />
                  ) : user ? (
                    <>
                      <div className="px-1 py-2">
                        <p className="text-sm font-semibold">{displayName(user)}</p>
                        <p className="text-xs text-muted truncate">{user.email}</p>
                      </div>
                      <NavLink to="/profile" className={linkClass} onClick={close}>
                        My Profile
                      </NavLink>
                      <NavLink to="/profile#orders" className={linkClass} onClick={close}>
                        My Orders
                      </NavLink>
                      <NavLink to="/profile#settings" className={linkClass} onClick={close}>
                        Settings
                      </NavLink>
                    </>
                  ) : (
                    <>
                      <NavLink to="/login" className={linkClass} onClick={close}>
                        Sign In
                      </NavLink>
                      <NavLink to="/signup" className={linkClass} onClick={close}>
                        Sign Up
                      </NavLink>
                    </>
                  )}
                  {isAdmin && (
                    <NavLink to="/admin" className={linkClass} onClick={close}>
                      Admin
                    </NavLink>
                  )}
                  {user && (
                    <button
                      type="button"
                      className="text-left text-[0.95rem] font-medium text-muted hover:text-volt min-h-11"
                      onClick={() => {
                        logout()
                        close()
                      }}
                    >
                      Sign Out
                    </button>
                  )}
                </nav>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </header>
  )
}

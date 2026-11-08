import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  Menu,
  X,
  ShoppingBag,
  Heart,
  User,
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

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { count } = useCart()
  const { ids: favIds } = useFavorites()
  const { ids: compareIds } = useCompare()
  const { user, isAdmin, logout } = useAuth()

  useEffect(() => {
    const escape = event => {
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
    'items-center justify-center rounded-[12px] p-2.5 min-h-11 min-w-11 hover:bg-silver/20 transition'

  const close = () => setOpen(false)

  return (
    <header className="sticky top-0 z-50">
      <div className="border-b border-silver/20 bg-white/80 dark:bg-ink/80 backdrop-blur-xl">
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

            <div className="hidden md:flex flex-1 min-w-0 max-w-xl ml-auto">
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

              {user ? (
                <div className="hidden sm:flex items-center gap-0.5">
                  <Link to="/profile" className={`inline-flex ${iconBtn}`} aria-label="Profile">
                    <User className="w-5 h-5" />
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="text-xs font-semibold text-muted hover:text-volt px-2.5 min-h-11"
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="hidden sm:inline-flex items-center text-sm font-semibold text-volt px-2.5 min-h-11"
                >
                  Sign in
                </Link>
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
              className="xl:hidden relative z-50 border-t border-silver/20 bg-white/95 dark:bg-ink/95 backdrop-blur-xl animate-slide-down"
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
                  <NavLink to={user ? '/profile' : '/login'} className={linkClass} onClick={close}>
                    {user ? 'Profile' : 'Sign in'}
                  </NavLink>
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
                      Log out
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

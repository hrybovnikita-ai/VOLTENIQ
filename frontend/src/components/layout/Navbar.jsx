import { useState } from 'react'
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

  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors ${
      isActive ? 'text-volt' : 'text-ink/70 dark:text-snow/70 hover:text-volt'
    }`

  return (
    <header className="sticky top-0 z-50">
      <div className="border-b border-silver/20 bg-white/70 dark:bg-ink/75 backdrop-blur-xl">
        <div className="container-shell">
          <div className="flex h-14 sm:h-16 items-center gap-2 sm:gap-3 min-w-0">
              <Link to="/" className="flex items-center gap-2 shrink-0 min-w-0">
                <span className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-[12px] bg-ink text-volt font-display font-extrabold glow-orange">
                  V
                </span>
                <span className="font-display text-lg sm:text-xl font-extrabold tracking-tight truncate max-[360px]:hidden">
                  VOLTENIQ
                </span>
              </Link>

              <nav className="hidden xl:flex items-center gap-5 ml-2 shrink-0">
                {links.map((l) => (
                  <NavLink key={l.to} to={l.to} className={linkClass}>
                    {l.label}
                  </NavLink>
                ))}
              </nav>

              <div className="hidden md:flex flex-1 min-w-0 max-w-xl ml-auto">
                <SearchAutocomplete />
              </div>

              <div className="flex items-center gap-0.5 sm:gap-1.5 ml-auto md:ml-2 shrink-0">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="rounded-[12px] p-2 hover:bg-silver/20 transition"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                <Link
                  to="/assistant"
                  className="hidden sm:inline-flex rounded-[12px] p-2 hover:bg-silver/20"
                  aria-label="AI Assistant"
                >
                  <Sparkles className="w-5 h-5 text-volt" />
                </Link>

                <Link to="/compare" className="relative rounded-[12px] p-2 hover:bg-silver/20" aria-label="Compare">
                  <GitCompareArrows className="w-5 h-5" />
                  {compareIds.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-volt text-[10px] font-bold text-ink flex items-center justify-center px-1">
                      {compareIds.length}
                    </span>
                  )}
                </Link>

                <Link to="/favorites" className="relative rounded-[12px] p-2 hover:bg-silver/20" aria-label="Favorites">
                  <Heart className="w-5 h-5" />
                  {favIds.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-volt text-[10px] font-bold text-ink flex items-center justify-center px-1">
                      {favIds.length}
                    </span>
                  )}
                </Link>

                <Link to="/cart" className="relative rounded-[12px] p-2 hover:bg-silver/20" aria-label="Cart">
                  <ShoppingBag className="w-5 h-5" />
                  {count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-volt text-[10px] font-bold text-ink flex items-center justify-center px-1">
                      {count}
                    </span>
                  )}
                </Link>

                {isAdmin && (
                  <Link to="/admin" className="hidden sm:inline-flex rounded-[12px] p-2 hover:bg-silver/20" aria-label="Admin">
                    <Shield className="w-5 h-5" />
                  </Link>
                )}

                {user ? (
                  <div className="hidden sm:flex items-center gap-1">
                    <Link to="/profile" className="rounded-[12px] p-2 hover:bg-silver/20" aria-label="Profile">
                      <User className="w-5 h-5" />
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      className="text-xs font-semibold text-muted hover:text-volt px-2"
                    >
                      Log out
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    className="hidden sm:inline-flex text-sm font-semibold text-volt px-2"
                  >
                    Sign in
                  </Link>
                )}

                <button
                  type="button"
                  className="xl:hidden rounded-[12px] p-2 hover:bg-silver/20"
                  onClick={() => setOpen((v) => !v)}
                  aria-label="Menu"
                  aria-expanded={open}
                >
                  {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>
        </div>

        {open && (
          <div className="xl:hidden border-t border-silver/20">
            <div className="container-shell py-4 space-y-4">
              <div className="md:hidden">
                <SearchAutocomplete onNavigate={() => setOpen(false)} />
              </div>
              <div className="flex flex-col gap-3">
                {links.map((l) => (
                  <NavLink key={l.to} to={l.to} className={linkClass} onClick={() => setOpen(false)}>
                    {l.label}
                  </NavLink>
                ))}
                <NavLink to="/favorites" className={linkClass} onClick={() => setOpen(false)}>
                  Favorites
                </NavLink>
                <NavLink to="/cart" className={linkClass} onClick={() => setOpen(false)}>
                  Bag
                </NavLink>
                <NavLink to={user ? '/profile' : '/login'} className={linkClass} onClick={() => setOpen(false)}>
                  {user ? 'Profile' : 'Sign in'}
                </NavLink>
                {isAdmin && (
                  <NavLink to="/admin" className={linkClass} onClick={() => setOpen(false)}>
                    Admin
                  </NavLink>
                )}
                {user && (
                  <button
                    type="button"
                    className="text-left text-sm font-medium text-muted hover:text-volt"
                    onClick={() => {
                      logout()
                      setOpen(false)
                    }}
                  >
                    Log out
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

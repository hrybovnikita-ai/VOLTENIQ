import { Link } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'

export default function Footer() {
  const { user } = useAuth()
  return (
    <footer className="mt-auto border-t border-silver/20">
      <div className="container-shell page-section !pt-10 !pb-8">
        <div className="grid gap-8 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4">
          <div className="xs:col-span-2 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-[12px] bg-ink text-volt font-display font-extrabold">
                V
              </span>
              <span className="font-display text-lg font-extrabold">VOLTENIQ</span>
            </div>
            <p className="section-copy max-w-md">
              A premium electronics e-commerce demo. All prices are labeled as demo prices.
              No real payments or card data are collected.
            </p>
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold mb-3">Shop</h4>
            <div className="flex flex-col gap-2.5 text-sm text-muted">
              <Link to="/catalog?category=iPhone" className="hover:text-volt min-h-10 inline-flex items-center">
                iPhone
              </Link>
              <Link to="/catalog?category=MacBook" className="hover:text-volt min-h-10 inline-flex items-center">
                MacBook
              </Link>
              <Link to="/catalog?category=iPad" className="hover:text-volt min-h-10 inline-flex items-center">
                iPad
              </Link>
              <Link to="/catalog?category=AirPods" className="hover:text-volt min-h-10 inline-flex items-center">
                AirPods
              </Link>
              <Link to="/catalog?category=Headphones" className="hover:text-volt min-h-10 inline-flex items-center">
                Headphones
              </Link>
            </div>
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold mb-3">Account</h4>
            <div className="flex flex-col gap-2.5 text-sm text-muted">
              {!user ? (
                <>
                  <Link to="/login" className="hover:text-volt min-h-10 inline-flex items-center">
                    Sign In
                  </Link>
                  <Link to="/signup" className="hover:text-volt min-h-10 inline-flex items-center">
                    Sign Up
                  </Link>
                </>
              ) : (
                <Link to="/profile" className="hover:text-volt min-h-10 inline-flex items-center">
                  Profile
                </Link>
              )}
              <Link to="/profile#orders" className="hover:text-volt min-h-10 inline-flex items-center">
                Orders
              </Link>
              <Link to="/assistant" className="hover:text-volt min-h-10 inline-flex items-center">
                AI Assistant
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-silver/20 flex flex-col sm:flex-row gap-2 justify-between text-xs text-muted">
          <p>© {new Date().getFullYear()} VOLTENIQ Demo Store</p>
          <p>Demo checkout only — no payment processing</p>
        </div>
      </div>
    </footer>
  )
}

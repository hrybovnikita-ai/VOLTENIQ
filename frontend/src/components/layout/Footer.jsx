import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-silver/20">
      <div className="container-shell page-section !pt-10 !pb-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-ink text-volt font-display font-extrabold">
                V
              </span>
              <span className="font-display text-lg font-extrabold">VOLTENIQ</span>
            </div>
            <p className="text-sm text-muted max-w-md leading-relaxed">
              A premium electronics e-commerce demo. All prices are labeled as demo prices.
              No real payments or card data are collected.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Shop</h4>
            <div className="flex flex-col gap-2 text-sm text-muted">
              <Link to="/catalog?category=iPhone" className="hover:text-volt">iPhone</Link>
              <Link to="/catalog?category=MacBook" className="hover:text-volt">MacBook</Link>
              <Link to="/catalog?category=iPad" className="hover:text-volt">iPad</Link>
              <Link to="/catalog?category=AirPods" className="hover:text-volt">AirPods</Link>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Account</h4>
            <div className="flex flex-col gap-2 text-sm text-muted">
              <Link to="/login" className="hover:text-volt">Sign in</Link>
              <Link to="/signup" className="hover:text-volt">Create account</Link>
              <Link to="/profile" className="hover:text-volt">Orders</Link>
              <Link to="/assistant" className="hover:text-volt">AI Assistant</Link>
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

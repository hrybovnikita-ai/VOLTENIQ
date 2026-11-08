import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Smartphone,
  Laptop,
  Tablet,
  Watch,
  Headphones,
  Cable,
  ShieldCheck,
  Zap,
  Sparkles,
} from 'lucide-react'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import ProductCard from '../components/products/ProductCard'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import ErrorState from '../components/ui/ErrorState'

const iconMap = {
  Smartphone,
  Laptop,
  Tablet,
  Watch,
  Headphones,
  Cable,
}

export default function HomePage() {
  const { data, loading, error, reload } = useApi(
    () =>
      Promise.all([api.getProducts(), api.getCategories()]).then(([catalog, cats]) => ({
        products: catalog.data.products || [],
        categories: cats.data.categories || [],
      })),
    []
  )

  const products = data?.products || []
  const categories = data?.categories || []

  return (
    <div className="w-full min-w-0">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-grid pointer-events-none" />
        <div className="container-shell pt-8 pb-10 sm:pt-14 sm:pb-16 lg:pt-20 lg:pb-24 relative">
          <div className="max-w-3xl min-w-0">
            <p className="animate-fade-up text-volt font-semibold tracking-[0.18em] uppercase text-[11px] sm:text-xs mb-3 sm:mb-4">
              Premium electronics demo
            </p>
            <h1 className="animate-fade-up delay-1 hero-title mb-4 sm:mb-6">
              VOLTENIQ
            </h1>
            <p className="animate-fade-up delay-2 section-copy max-w-xl mb-6 sm:mb-8 text-base sm:text-lg lg:text-xl !leading-relaxed">
              Discover iPhone, MacBook, iPad, Watch, and AirPods in a polished demo store.
              Every price is clearly marked as demo — no real payments.
            </p>
            <div className="animate-fade-up delay-3 flex flex-col sm:flex-row flex-wrap gap-3">
              <Button as={Link} to="/catalog" size="lg" className="w-full sm:w-auto justify-center">
                Shop catalog <ArrowRight className="w-4 h-4" />
              </Button>
              <Button as={Link} to="/assistant" variant="ghost" size="lg" className="w-full sm:w-auto justify-center">
                <Sparkles className="w-4 h-4" /> Ask AI assistant
              </Button>
            </div>
          </div>

          <div className="mt-9 sm:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-4xl">
            {[
              { icon: Zap, title: 'Curated catalog', text: 'Realistic Apple-inspired product lineup' },
              { icon: ShieldCheck, title: 'Safe demo checkout', text: 'No cards. No charges. Demo only.' },
              { icon: Sparkles, title: 'AI shopping UI', text: 'Assistant available from navigation' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="glass rounded-[16px] p-4 sm:p-5 min-w-0">
                <Icon className="w-5 h-5 text-volt mb-2.5" />
                <h3 className="font-semibold mb-1 text-sm sm:text-base">{title}</h3>
                <p className="text-sm text-muted leading-snug">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-shell pb-10 sm:pb-14">
        <div className="mb-5 sm:mb-7">
          <h2 className="page-title">Categories</h2>
          <p className="section-copy mt-1">Browse by product family</p>
        </div>
        <div className="category-grid">
          {(categories.length
            ? categories
            : [
                { id: 'iPhone', name: 'iPhone', icon: 'Smartphone' },
                { id: 'MacBook', name: 'MacBook', icon: 'Laptop' },
                { id: 'iPad', name: 'iPad', icon: 'Tablet' },
                { id: 'Apple Watch', name: 'Apple Watch', icon: 'Watch' },
                { id: 'AirPods', name: 'AirPods', icon: 'Headphones' },
                { id: 'Headphones', name: 'Headphones', icon: 'Headphones' },
                { id: 'Accessories', name: 'Accessories', icon: 'Cable' },
              ]
          ).map((cat) => {
            const Icon = iconMap[cat.icon] || Smartphone
            return (
              <Link
                key={cat.id}
                to={`/catalog?category=${encodeURIComponent(cat.id)}`}
                className="glass rounded-[16px] p-3.5 sm:p-4 text-center hover:glow-orange transition group min-w-0"
              >
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-2 text-volt group-hover:scale-110 transition" />
                <span className="text-xs sm:text-sm font-semibold truncate block">{cat.name}</span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="container-shell pb-12 sm:pb-16 lg:pb-20">
        <div className="flex items-end justify-between gap-3 mb-5 sm:mb-7">
          <div className="min-w-0">
            <h2 className="page-title">Product catalog</h2>
            <p className="section-copy mt-1">Browse the full collection</p>
          </div>
          <Button as={Link} to="/catalog" variant="ghost" size="sm" className="shrink-0">
            View all
          </Button>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        )}
        {error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { formatPrice, formatDate } from '../utils/format'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'

const emptyProduct = {
  name: '',
  slug: '',
  description: '',
  category: 'Accessories',
  price: 99,
  image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80',
  featured: false,
  stock: 20,
  colors: ['Black'],
  storage: [],
  specs: { note: 'Demo product' },
  images: [],
}

export default function AdminPage() {
  const { isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyProduct)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/login')
  }, [authLoading, isAdmin, navigate])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [s, p, o] = await Promise.all([
        api.adminStats(),
        api.adminProducts(),
        api.adminOrders(),
      ])
      setStats(s.data.stats)
      setProducts(p.data.products || [])
      setOrders(o.data.orders || [])
    } catch (err) {
      setError(err.message || 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin])

  const createProduct = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock),
        images: form.images?.length ? form.images : [form.image],
        slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-'),
      }
      await api.adminCreateProduct(payload)
      setForm(emptyProduct)
      await load()
      setTab('products')
    } catch (err) {
      setError(err.message || 'Create failed')
    }
  }

  const removeProduct = async (id) => {
    if (!confirm('Delete this demo product?')) return
    await api.adminDeleteProduct(id)
    await load()
  }

  const updateStatus = async (id, status) => {
    await api.adminUpdateOrderStatus(id, status)
    await load()
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="container-shell page-section">
      <h1 className="page-title mb-2">Admin</h1>
      <p className="text-muted mb-5 sm:mb-6 text-sm sm:text-base">Manage demo products and orders</p>

      <div className="flex flex-wrap gap-2 mb-8">
        {['overview', 'products', 'orders', 'create'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-semibold border capitalize ${
              tab === t ? 'bg-volt text-ink border-volt' : 'border-silver/30'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {tab === 'overview' && stats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Products', value: stats.products },
            { label: 'Orders', value: stats.orders },
            { label: 'Users', value: stats.users },
            { label: 'Demo revenue', value: formatPrice(stats.revenue) },
          ].map((card) => (
            <div key={card.label} className="glass rounded-[18px] p-5">
              <p className="text-sm text-muted mb-1">{card.label}</p>
              <p className="font-display text-3xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'products' && (
        <div className="space-y-3">
          {products.map((p) => (
            <div key={p.id} className="glass rounded-[16px] p-4 flex flex-wrap items-center gap-4">
              <img src={p.image} alt="" className="w-16 h-16 rounded-[12px] object-contain bg-silver/10 p-1" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{p.name}</p>
                <p className="text-sm text-muted">
                  {p.category} · {formatPrice(p.price)} · stock {p.stock}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeProduct(p.id)}>
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="glass rounded-[16px] p-4">
              <div className="flex flex-wrap justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold">{order.user?.email || order.userId}</p>
                  <p className="text-xs text-muted">{formatDate(order.createdAt)}</p>
                </div>
                <p className="font-bold">{formatPrice(order.total)}</p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={order.status}
                  onChange={(e) => updateStatus(order.id, e.target.value)}
                  className="rounded-[12px] border border-silver/30 bg-transparent px-3 py-2 text-sm"
                >
                  {['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-volt">Demo order</span>
              </div>
            </div>
          ))}
          {!orders.length && <p className="text-muted">No demo orders yet.</p>}
        </div>
      )}

      {tab === 'create' && (
        <form onSubmit={createProduct} className="glass rounded-[20px] p-6 max-w-2xl space-y-4">
          <h2 className="font-display text-xl font-bold">Add demo product</h2>
          {['name', 'slug', 'description', 'category', 'image'].map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1.5 capitalize">{field}</label>
              {field === 'description' ? (
                <textarea
                  required
                  rows={3}
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="w-full rounded-[14px] border border-silver/30 bg-white/50 dark:bg-graphite/50 px-4 py-2.5 outline-none focus:border-volt"
                />
              ) : (
                <input
                  required={field !== 'slug'}
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="w-full rounded-[14px] border border-silver/30 bg-white/50 dark:bg-graphite/50 px-4 py-2.5 outline-none focus:border-volt"
                />
              )}
            </div>
          ))}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Price (demo)</label>
              <input
                type="number"
                required
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full rounded-[14px] border border-silver/30 bg-white/50 dark:bg-graphite/50 px-4 py-2.5 outline-none focus:border-volt"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Stock</label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                className="w-full rounded-[14px] border border-silver/30 bg-white/50 dark:bg-graphite/50 px-4 py-2.5 outline-none focus:border-volt"
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
            />
            Featured
          </label>
          <Button type="submit">Create product</Button>
        </form>
      )}
    </div>
  )
}

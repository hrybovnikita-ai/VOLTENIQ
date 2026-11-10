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
  const [users, setUsers] = useState([])
  const [reviews, setReviews] = useState([])
  const [promos, setPromos] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyProduct)
  const [promoForm, setPromoForm] = useState({
    code: '',
    description: '',
    type: 'PERCENTAGE',
    value: 10,
    minOrderAmount: 0,
    maxUses: 100,
    perUserLimit: 1,
    expiresAt: '',
  })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState({})
  const [trackingDraft, setTrackingDraft] = useState({})

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/login')
  }, [authLoading, isAdmin, navigate])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [s, p, o, u, r, pr] = await Promise.all([
        api.adminStats(),
        api.adminProducts(),
        api.adminOrders(),
        api.adminUsers(),
        api.adminReviews(),
        api.adminPromos(),
      ])
      setStats(s.data.stats)
      setProducts(p.data.products || [])
      setOrders(o.data.orders || [])
      setUsers(u.data.users || [])
      setReviews(r.data.reviews || [])
      setPromos(pr.data.promos || [])
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
      setMessage('Product created')
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

  const saveProductFields = async (id) => {
    const draft = editing[id]
    if (!draft) return
    try {
      await api.adminUpdateProduct(id, {
        price: Number(draft.price),
        stock: Number(draft.stock),
      })
      setEditing((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setMessage('Product updated')
      await load()
    } catch (err) {
      setError(err.message || 'Update failed')
    }
  }

  const updateStatus = async (id, status) => {
    await api.adminUpdateOrderStatus(id, status)
    setMessage(`Order marked ${status}`)
    await load()
  }

  const saveTracking = async (id) => {
    const draft = trackingDraft[id] || {}
    try {
      await api.adminUpdateOrderTracking(id, {
        status: draft.status,
        trackingNumber: draft.trackingNumber || undefined,
        estimatedDelivery: draft.estimatedDelivery || undefined,
        note: draft.note || undefined,
      })
      setMessage('Simulated tracking updated')
      await load()
    } catch (err) {
      setError(err.message || 'Tracking update failed')
    }
  }

  const createPromo = async (e) => {
    e.preventDefault()
    try {
      await api.adminCreatePromo({
        ...promoForm,
        value: Number(promoForm.value),
        minOrderAmount: Number(promoForm.minOrderAmount) || 0,
        maxUses: promoForm.maxUses === '' ? null : Number(promoForm.maxUses),
        perUserLimit: Number(promoForm.perUserLimit) || 1,
        expiresAt: promoForm.expiresAt || null,
      })
      setPromoForm({
        code: '',
        description: '',
        type: 'PERCENTAGE',
        value: 10,
        minOrderAmount: 0,
        maxUses: 100,
        perUserLimit: 1,
        expiresAt: '',
      })
      setMessage('Promo created')
      await load()
      setTab('promos')
    } catch (err) {
      setError(err.message || 'Promo create failed')
    }
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
      <p className="text-muted mb-5 sm:mb-6 text-sm sm:text-base">
        Manage products, stock, users, and demo orders
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        {['overview', 'products', 'orders', 'reviews', 'promos', 'users', 'create'].map((t) => (
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
      {message && <p className="text-sm text-green-600 mb-4">{message}</p>}

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
          {products.map((p) => {
            const draft = editing[p.id] || { price: p.price, stock: p.stock }
            const isEditing = Boolean(editing[p.id])
            return (
              <div key={p.id} className="glass rounded-[16px] p-4 flex flex-wrap items-center gap-4">
                <img
                  src={p.image}
                  alt=""
                  className="w-16 h-16 rounded-[12px] object-contain bg-silver/10 p-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{p.name}</p>
                  <p className="text-sm text-muted">{p.category}</p>
                </div>
                {isEditing ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs text-muted">
                      Price
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.price}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [p.id]: { ...draft, price: e.target.value },
                          }))
                        }
                        className="mt-1 block w-24 rounded-[10px] border border-silver/30 bg-transparent px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="text-xs text-muted">
                      Stock
                      <input
                        type="number"
                        min="0"
                        value={draft.stock}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [p.id]: { ...draft, stock: e.target.value },
                          }))
                        }
                        className="mt-1 block w-20 rounded-[10px] border border-silver/30 bg-transparent px-2 py-1.5 text-sm"
                      />
                    </label>
                    <Button size="sm" onClick={() => saveProductFields(p.id)}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditing((prev) => {
                          const next = { ...prev }
                          delete next[p.id]
                          return next
                        })
                      }
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm">
                      {formatPrice(p.price)} · stock {p.stock}
                    </p>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() =>
                        setEditing((prev) => ({
                          ...prev,
                          [p.id]: { price: p.price, stock: p.stock },
                        }))
                      }
                    >
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeProduct(p.id)}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-3">
          {orders.map((order) => {
            const draft = trackingDraft[order.id] || {
              status: order.status,
              trackingNumber: order.trackingNumber || '',
              estimatedDelivery: order.estimatedDelivery
                ? String(order.estimatedDelivery).slice(0, 10)
                : '',
              note: '',
            }
            return (
              <div key={order.id} className="glass rounded-[16px] p-4 space-y-3">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-semibold">{order.orderNumber || order.id.slice(0, 8)}</p>
                    <p className="text-sm">{order.user?.email || order.userId}</p>
                    <p className="text-xs text-muted">{formatDate(order.createdAt)}</p>
                  </div>
                  <p className="font-bold">{formatPrice(order.total)}</p>
                </div>
                <ul className="text-sm text-muted space-y-1">
                  {order.items?.map((item) => (
                    <li key={item.id}>
                      {item.product?.name || 'Product'} × {item.quantity}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-volt">
                  Simulated tracking — no real shipment. Quick status:{' '}
                  <button type="button" className="underline" onClick={() => updateStatus(order.id, 'PROCESSING')}>
                    Processing
                  </button>
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <select
                    value={draft.status}
                    onChange={(e) =>
                      setTrackingDraft((prev) => ({
                        ...prev,
                        [order.id]: { ...draft, status: e.target.value },
                      }))
                    }
                    className="rounded-[12px] border border-silver/30 bg-transparent px-3 py-2 text-sm"
                  >
                    {['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Tracking number"
                    value={draft.trackingNumber}
                    onChange={(e) =>
                      setTrackingDraft((prev) => ({
                        ...prev,
                        [order.id]: { ...draft, trackingNumber: e.target.value },
                      }))
                    }
                    className="rounded-[12px] border border-silver/30 bg-transparent px-3 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={draft.estimatedDelivery}
                    onChange={(e) =>
                      setTrackingDraft((prev) => ({
                        ...prev,
                        [order.id]: { ...draft, estimatedDelivery: e.target.value },
                      }))
                    }
                    className="rounded-[12px] border border-silver/30 bg-transparent px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Status note"
                    value={draft.note}
                    onChange={(e) =>
                      setTrackingDraft((prev) => ({
                        ...prev,
                        [order.id]: { ...draft, note: e.target.value },
                      }))
                    }
                    className="rounded-[12px] border border-silver/30 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
                <Button size="sm" onClick={() => saveTracking(order.id)}>
                  Save simulated tracking
                </Button>
              </div>
            )
          })}
          {!orders.length && <p className="text-muted">No demo orders yet.</p>}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="glass rounded-[16px] p-4 flex flex-wrap gap-3 justify-between">
              <div className="min-w-0">
                <p className="font-semibold">{review.product?.name || review.productId}</p>
                <p className="text-sm text-muted">
                  {review.user?.email || review.user?.name} · {review.rating}/5 · {review.status}
                  {review.verified ? ' · Verified' : ''}
                </p>
                <p className="text-sm mt-1">{review.body}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['APPROVED', 'PENDING', 'REJECTED'].map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={review.status === status ? 'primary' : 'ghost'}
                    onClick={async () => {
                      await api.adminModerateReview(review.id, status)
                      await load()
                    }}
                  >
                    {status}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm('Delete review?')) return
                    await api.adminDeleteReview(review.id)
                    await load()
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {!reviews.length && <p className="text-muted">No reviews yet.</p>}
        </div>
      )}

      {tab === 'promos' && (
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-3">
            {promos.map((promo) => (
              <div key={promo.id} className="glass rounded-[16px] p-4 flex flex-wrap gap-3 justify-between">
                <div>
                  <p className="font-semibold">{promo.code}</p>
                  <p className="text-sm text-muted">
                    {promo.type === 'PERCENTAGE' ? `${promo.value}%` : formatPrice(promo.value)} · used{' '}
                    {promo.usedCount}
                    {promo.maxUses != null ? `/${promo.maxUses}` : ''} · min{' '}
                    {formatPrice(promo.minOrderAmount)}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    {promo.active ? 'Active' : 'Inactive'}
                    {promo.expiresAt ? ` · expires ${formatDate(promo.expiresAt)}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={async () => {
                      await api.adminUpdatePromo(promo.id, { active: !promo.active })
                      await load()
                    }}
                  >
                    {promo.active ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm('Delete promo?')) return
                      await api.adminDeletePromo(promo.id)
                      await load()
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {!promos.length && <p className="text-muted">No promo codes yet.</p>}
          </div>
          <form onSubmit={createPromo} className="glass rounded-[18px] p-4 space-y-3 h-fit">
            <h2 className="font-display text-lg font-bold">Create promo</h2>
            <input
              required
              placeholder="CODE"
              value={promoForm.code}
              onChange={(e) => setPromoForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              className="w-full rounded-[12px] border border-silver/30 bg-transparent px-3 py-2 text-sm"
            />
            <input
              placeholder="Description"
              value={promoForm.description}
              onChange={(e) => setPromoForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-[12px] border border-silver/30 bg-transparent px-3 py-2 text-sm"
            />
            <select
              value={promoForm.type}
              onChange={(e) => setPromoForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full rounded-[12px] border border-silver/30 bg-transparent px-3 py-2 text-sm"
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED">Fixed USD</option>
            </select>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={promoForm.value}
              onChange={(e) => setPromoForm((f) => ({ ...f, value: e.target.value }))}
              className="w-full rounded-[12px] border border-silver/30 bg-transparent px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="0"
              placeholder="Min order"
              value={promoForm.minOrderAmount}
              onChange={(e) => setPromoForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
              className="w-full rounded-[12px] border border-silver/30 bg-transparent px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="1"
              placeholder="Max uses"
              value={promoForm.maxUses}
              onChange={(e) => setPromoForm((f) => ({ ...f, maxUses: e.target.value }))}
              className="w-full rounded-[12px] border border-silver/30 bg-transparent px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={promoForm.expiresAt}
              onChange={(e) => setPromoForm((f) => ({ ...f, expiresAt: e.target.value }))}
              className="w-full rounded-[12px] border border-silver/30 bg-transparent px-3 py-2 text-sm"
            />
            <Button type="submit" className="w-full">
              Create promo
            </Button>
          </form>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="glass rounded-[16px] p-4 flex flex-wrap items-center gap-4">
              <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-graphite text-sm font-bold text-volt">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  (user.name || user.email || 'U').slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{user.name}</p>
                <p className="text-sm text-muted truncate">{user.email}</p>
              </div>
              <span className="rounded-full border border-silver/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                {user.role}
              </span>
              <span className="text-xs text-muted">{formatDate(user.createdAt)}</span>
            </div>
          ))}
          {!users.length && <p className="text-muted">No users found.</p>}
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

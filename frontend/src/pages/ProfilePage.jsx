import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { formatDate, formatPrice } from '../utils/format'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'

export default function ProfilePage() {
  const { user, isAuthenticated, loading: authLoading, updateProfile, logout, isAdmin } = useAuth()
  const [orders, setOrders] = useState([])
  const [alerts, setAlerts] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash, loading])
  const highlight = params.get('order')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login')
  }, [authLoading, isAuthenticated, navigate])

  useEffect(() => {
    if (user) setName(user.name || '')
  }, [user])

  useEffect(() => {
    if (!isAuthenticated) return
    setLoading(true)
    Promise.all([
      api.getOrders().catch(() => ({ data: { orders: [] } })),
      api.getPriceAlerts().catch(() => ({ data: { alerts: [] } })),
      api.getAlertNotifications().catch(() => ({ data: { notifications: [] } })),
    ])
      .then(([ordersRes, alertsRes, notesRes]) => {
        setOrders(ordersRes.data.orders || [])
        setAlerts(alertsRes.data.alerts || [])
        setNotifications(notesRes.data.notifications || [])
      })
      .finally(() => setLoading(false))
  }, [isAuthenticated])

  const removeAlert = async (id) => {
    try {
      await api.deletePriceAlert(id)
      setAlerts((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      setError(err.message || 'Could not remove alert')
    }
  }

  const onSave = async (e) => {
    e.preventDefault()
    setMessage('')
    setError('')
    try {
      await updateProfile({ name, ...(password ? { password } : {}) })
      setPassword('')
      setMessage('Profile updated')
    } catch (err) {
      setError(err.message || 'Update failed')
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="container-shell page-section">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="page-title">Profile</h1>
          <p className="text-muted mt-1 text-sm sm:text-base break-all">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button as={Link} to="/admin" variant="soft">
              Admin dashboard
            </Button>
          )}
          <Button variant="ghost" onClick={logout}>
            Log out
          </Button>
        </div>
      </div>

      {highlight && (
        <div className="mb-6 rounded-[14px] border border-volt/40 bg-volt/10 px-4 py-3 text-sm">
          Demo order <strong>{highlight}</strong> placed successfully. No payment was processed.
        </div>
      )}

      <div className="split-layout split-layout--profile">
        <form id="settings" style={{ scrollMarginTop: 80 }} onSubmit={onSave} className="glass rounded-[16px] sm:rounded-[20px] p-4 sm:p-6 space-y-4 h-fit min-w-0">
          <h2 className="font-display text-xl font-bold">Account</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-[14px] border border-silver/30 bg-white/50 dark:bg-graphite/50 px-4 py-2.5 outline-none focus:border-volt"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              className="w-full rounded-[14px] border border-silver/30 bg-white/50 dark:bg-graphite/50 px-4 py-2.5 outline-none focus:border-volt"
            />
          </div>
          {message && <p className="text-sm text-green-600">{message}</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full">
            Save changes
          </Button>
        </form>

        <div className="min-w-0 space-y-10">
          <section>
            <h2 className="font-display text-xl font-bold mb-4">Price drop alerts</h2>
            {loading && (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            )}
            {!loading && !alerts.length && (
              <p className="text-sm text-muted mb-4">
                No alerts yet. Open a product and choose “Notify me when price drops”.
              </p>
            )}
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="glass rounded-[16px] p-4 flex flex-wrap items-center gap-3 justify-between">
                  <div className="min-w-0 flex items-center gap-3">
                    {alert.product?.image ? (
                      <img
                        src={alert.product.image}
                        alt=""
                        className="h-12 w-12 rounded-[10px] object-contain bg-silver/10"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{alert.product?.name || 'Product'}</p>
                      <p className="text-xs text-muted">
                        Watching from {formatPrice(alert.subscribedPrice)} · now{' '}
                        {formatPrice(alert.currentPrice)}
                        {alert.dropped ? ' · dropped' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button as={Link} to={`/products/${alert.product?.slug || alert.productId}`} variant="soft">
                      View
                    </Button>
                    <Button variant="ghost" onClick={() => removeAlert(alert.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {notifications.length ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Recent notifications</p>
                {notifications.slice(0, 5).map((note) => (
                  <p key={note.id} className="text-sm glass rounded-[12px] px-3 py-2">
                    {note.message}
                  </p>
                ))}
              </div>
            ) : null}
          </section>

          <section id="orders" style={{ scrollMarginTop: 80 }}>
            <h2 className="font-display text-xl font-bold mb-4">Order history</h2>
            {!loading && !orders.length && (
              <EmptyState
                title="No orders yet"
                description="Place a demo checkout to see your history here."
                actionLabel="Shop now"
                onAction={() => navigate('/catalog')}
              />
            )}
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className={`glass rounded-[18px] p-5 ${
                    highlight === order.id ? 'ring-2 ring-volt' : ''
                  }`}
                >
                  <div className="flex flex-wrap justify-between gap-2 mb-3">
                    <div>
                      <p className="font-semibold">Order {order.id.slice(0, 8)}…</p>
                      <p className="text-xs text-muted">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatPrice(order.total)}</p>
                      <p className="text-xs uppercase tracking-wider text-volt">{order.status}</p>
                    </div>
                  </div>
                  <ul className="text-sm text-muted space-y-1 mb-3">
                    {order.items?.map((item) => (
                      <li key={item.id}>
                        {item.product?.name || 'Product'} × {item.quantity}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-volt">{order.demoNote || 'DEMO ORDER — no real payment'}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
